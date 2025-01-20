import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'

export class StableDiffusionComfyuiEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'VPC', { isDefault: true });

    const ubuntuLinux = ec2.MachineImage.fromSsmParameter(
      '/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id',
      { os: ec2.OperatingSystemType.LINUX }
    );

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'apt-get update -y',
      'apt install gcc -y',
      `distribution=$(. /etc/os-release;echo $ID$VERSION_ID | sed -e 's/\\.//g')`,
      'wget https://developer.download.nvidia.com/compute/cuda/repos/$distribution/x86_64/cuda-keyring_1.1-1_all.deb',
      'dpkg -i cuda-keyring_1.1-1_all.deb',
      'apt-get update -y',
      'apt-get -y install cuda-drivers',
      'modprobe nvidia',
      'apt-get -y install python3-pip python-is-python3',
      'pip install https://s3.amazonaws.com/cloudformation-examples/aws-cfn-bootstrap-py3-latest.tar.gz',
      'mkdir -p /opt/aws/bin',
      'ln -s /usr/local/bin/cfn-* /opt/aws/bin/',
      'cd /home/ubuntu',
      `su ubuntu -c 'git clone https://github.com/comfyanonymous/ComfyUI'`,
      'cd ComfyUI',
      `su ubuntu -c 'wget -P models/checkpoints https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors'`,
      `su ubuntu -c 'wget -P models/checkpoints https://huggingface.co/stabilityai/stable-diffusion-xl-refiner-1.0/resolve/main/sd_xl_refiner_1.0.safetensors'`,
      `su ubuntu -c 'wget -P models/vae https://huggingface.co/madebyollin/sdxl-vae-fp16-fix/resolve/main/sdxl_vae.safetensors'`,
      `su ubuntu -c 'wget -P models/checkpoints https://huggingface.co/playgroundai/playground-v2.5-1024px-aesthetic/resolve/main/playground-v2.5-1024px-aesthetic.fp16.safetensors'`,
      `su ubuntu -c 'pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu124'`,
      `su ubuntu -c 'pip install -r requirements.txt'`,
    );

    const keyPair = "comfyui-key-pair.pem";
    const keyName = keyPair.split(".")[0];
    const ec2keyPair = new ec2.KeyPair(this, 'KeyPair', {
      keyPairName: keyName
    });
    ec2keyPair.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)

    const instance = new ec2.Instance(this, 'Instance', {
      vpc: vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.G6E, ec2.InstanceSize.XLARGE),
      machineImage: ubuntuLinux,
      blockDevices: [{
        deviceName: '/dev/sda1',
        volume: ec2.BlockDeviceVolume.ebs(200)   // You can change the disk size as you want
      }],
      userData: userData,
      keyPair: ec2keyPair,
      init: ec2.CloudFormationInit.fromElements(
        ec2.InitCommand.shellCommand(`su ubuntu -c 'nohup python main.py --listen --port 8080 > ./sd-comfyui.log 2>&1 &'`),
      ),
      resourceSignalTimeout: cdk.Duration.minutes(30),

    });

    instance.connections.allowFromAnyIpv4(ec2.Port.tcp(22), 'Allow ssh from internet');
    instance.connections.allowFromAnyIpv4(ec2.Port.tcp(443), 'Allow https from internet'); // if you don't want to enable "share" flag for directly public access, comment this line out.
    instance.connections.allowFromAnyIpv4(ec2.Port.tcp(8080), 'Allow access port 8080 from internet');

    new cdk.CfnOutput(this, 'InstanceConsole', {
      value: 'https://console.aws.amazon.com/ec2/home?region=' + instance.env.region + '#Instances:search=' + instance.instanceId,
      description: 'The AWS console for Comfyui EC2 instance'
    });
    new cdk.CfnOutput(this, 'GetSSHKeyCommand', {
      value: `aws ssm get-parameter --name /ec2/keypair/${ec2keyPair.keyPairId} --region ${this.region} --with-decryption --query Parameter.Value --output text > ${keyPair} && chmod 400 ${keyPair}`,
      description: 'The private key for ssh access EC2 instance'
    })
    new cdk.CfnOutput(this, 'ComfyuiPotal', {
      value: instance.instancePublicDnsName + ':8080',
      description: 'SD-Comfyui access endpoint'
    })
  }
}
