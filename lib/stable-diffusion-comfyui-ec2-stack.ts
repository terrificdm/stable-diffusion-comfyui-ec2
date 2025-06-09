import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'

export class StableDiffusionComfyuiEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'VPC', { isDefault: true });

    const ubuntuLinux = ec2.MachineImage.fromSsmParameter(
      '/aws/service/deeplearning/ami/x86_64/base-oss-nvidia-driver-gpu-ubuntu-24.04/latest/ami-id',
      { os: ec2.OperatingSystemType.LINUX }
    );

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'cd /home/ubuntu',
      `su ubuntu -c 'git clone https://github.com/comfyanonymous/ComfyUI'`,
      'cd ComfyUI',
      'python3 -m venv .venv',
      'source .venv/bin/activate',
      'pip install https://s3.amazonaws.com/cloudformation-examples/aws-cfn-bootstrap-py3-latest.tar.gz',
      'mkdir -p /opt/aws/bin',
      'ln -s /home/ubuntu/ComfyUI/.venv/bin/cfn-* /opt/aws/bin/',
      'pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu128',
      'pip install -r requirements.txt',
      `su ubuntu -c 'wget -P models/checkpoints https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors'`,
      `su ubuntu -c 'wget -P models/checkpoints https://huggingface.co/stabilityai/stable-diffusion-xl-refiner-1.0/resolve/main/sd_xl_refiner_1.0.safetensors'`,
      `su ubuntu -c 'wget -P models/vae https://huggingface.co/madebyollin/sdxl-vae-fp16-fix/resolve/main/sdxl_vae.safetensors'`
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
      availabilityZone: 'us-east-1d',  // Just in case no capacity in default AZ, you can change the AZ as you want, or comment this out.
      blockDevices: [{
        deviceName: '/dev/sda1',
        volume: ec2.BlockDeviceVolume.ebs(200)   // You can change the disk size as you want
      }],
      userData: userData,
      keyPair: ec2keyPair,
      init: ec2.CloudFormationInit.fromElements(
        ec2.InitCommand.shellCommand(`su ubuntu -c 'source .venv/bin/activate && nohup python main.py --listen --port 8080 > ./sd-comfyui.log 2>&1 &'`),
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
