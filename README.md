# CDK deploy Stable Diffusion ComfyUI on EC2   

* Automatically install [ComfyUI](https://github.com/comfyanonymous/ComfyUI) on AWS EC2 instance  
* Expose ComfyUI endpoint("ComfyUIPotal" in cloudformation's Outputs) through EC2 public domain name with dedicated port  
* You need to get ssh key-pair through "GetSSHKeyCommand" in cloudformation's Outputs first if you want to access EC2 instance
* Default instance type is g6e.xlarge, you can change with others  

# Build  
* Make sure you follow the [AWS CDK Prerequisites](https://docs.aws.amazon.com/cdk/v2/guide/prerequisites.html) before you build the project.
* Clone this project and change the directory to the root folder of the project, and run below commands:
```bash
$ npm install -g aws-cdk
$ npm install  
$ cdk bootstrap
```

# Deploy  
* Run commands as below:
```bash
$ cdk synth
$ cdk deploy
```

# Clean  
```bash
$ cdk destroy
```

# Notes  
* The scripts will automatically download sdxl base and refiner models for you  
* ComfyUI files are under /home/ubuntu/ComfyUI directory  
* Default command in CDK scripts for running SD-ComfyUI is `source .venv/bin/activate` `nohup python main.py --listen --port 8080 > ./sd-comfyui.log 2>&1 &`, you can kill that process and run your own. Remember to source venv first.  
* You can use "tail -f /home/ubuntu/ComfyUI/sd-comfyui.log" to get real time logs for ComfyUI  
* Regarding how to use ComfyUI, read its [official repo](https://github.com/comfyanonymous/ComfyUI)  