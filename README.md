# Lattice Play

*Note from the raindancer:*
 As the Tttle says, this is a play project. But Play with intent.  I wanted to get my head around Lattice works, and how L2 Constructs for the aws-cdk-lib may be created. This is very much experiemental.  Use it however you want.  If you need something more stable, wait till AWS publishes offical cdk contructs. 

 This is a very short form readme, and assumes the reader, just needs a few hints to use this. This is'nt a full workshop.

## Environment:

This cdk app, will create a very simple example with the following items.

- A single VPC. This vpc has two isolated subnets, with no internet connectivity. 

- SSM endpoints so and EC2 instance can be reached via SSM

- An EC2 instance (t3.small) which can be used for testing lattice.
- A lambda that provides a simple helloworld response, that is used as a target for a...
- lattice target group, which is used by a
- lattice listener which is associated with 
- a lattice service, which is part of a lattice service network. 



## Prerequisites. 
- The standard stuff. You need an aws account,
- You need aws-cdk installed ( you'll need 2.79.0 or higher )
- The account needs to be bootstraped.

## Install.
- Clone this repo  `git clone https://github.com/raindancers/latticeplay`
- edit line 20 and 21 of `cdk.json` to reflect your account and region. 
- `cdk deploy --profile <yourprofile>`

If you want to synth this first you will need to use a --profile as this cdk app will do context-lookups for the vpc

## Test lattice via SSM.

Open AWS Console and open Lattice ( from VPC page ). Find the Lattice Service URL. 

Open your AWS Console, and navigate to the EC2 Page. Find the instance called 'testhost-1'. Connect to it via SSM.   Run these commands to demonstrate the service, substituting the url for the one you just found

(1) Try to connect to the lattice service on http
```
sh-4.2$ bash
[ssm-user@testhost-1 bin]$ curl latticestack-serviceonelatt-wjkccuateyba-00aa8dfff2eeef9b2.7d67968.vpc-lattice-svcs.ap-southeast-2.on.aws
```
The response is a reset by pair, as we have not configured HTTP
```
curl: (56) Recv failure: Connection reset by peer
```

(2) Try to connect to the base url on https
```
[ssm-user@testhost-1 bin]$ curl https://latticestack-serviceonelatt-wjkccuateyba-00aa8dfff2eeef9b2.7d67968.vpc-lattice-svcs.ap-southeast-2.on.aws
```
The reponse should be 'Not Found',  lattice is returning a fixed reponse of 404, this is the default rule, because there is no matching rule.

```
Not Found
```

(3) Try to connect to 'serviceOne' which maps to the helloworld lambda. 

```
[ssm-user@testhost-1 bin]$ curl https://latticestack-serviceonelatt-wjkccuateyba-00aa8dfff2eeef9b2.7d67968.vpc-lattice-svcs.ap-southeast-2.on.aws/serviceOne
```

The response shoudl be 'Hello from region'. This is using the rule that matches to the path.

```
Hello from ap-southeast-2
```

There is a lot more functionality in the construct code that is included in this repo, this was just to give you some idea of what it can do.   Please send me a PR if you create something cool,
or raise an issue if you run into a problem.

Note: Amazon VPC Lattice is available in the following AWS Regions: US East (Ohio), US East (N. Virginia), US West (Oregon), Asia Pacific (Singapore), Asia Pacific (Sydney), Asia Pacific (Tokyo), and Europe (Ireland)


## Todo:
Check Git Issues.

