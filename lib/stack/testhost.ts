import * as cdk from "aws-cdk-lib";
import * as constructs from "constructs";
import { aws_ec2 as ec2, aws_route53 as r53 } from "aws-cdk-lib";
import * as fs from "fs";
import * as path from 'path';

interface TestHostProps {
  /**
   * Vpc which the instance will be placed in
   */
  readonly vpc: ec2.Vpc;
  /**
   * subnet selection for where the instance will be placed
   */
  readonly subnets: ec2.SubnetSelection;
  /**
   * Zone where to add a record for the instance
   */
  readonly r53zone: r53.PrivateHostedZone;
  /**
   * the instances hostname
   */
  readonly hostname: string;
}
/**
 * Create a Webserver instance
 */
export class TestHost extends constructs.Construct {
  webserver: ec2.Instance;

  constructor(scope: constructs.Construct, id: string, props: TestHostProps) {
    super(scope, id);

    /**
     * This instance is created without a key pair. Access to the instance is only possible via SSM.
     * This removes the need for the instance to need to ahave open ssh access
     * The instance is also required to use Imdsv2 to protect against weekness in v1
     * The instance's role is given permission to use SSM, using the ssmSessionPermissions parameter.
     */
    this.webserver = new ec2.Instance(this, `${props.hostname}webserver`, {
      vpc: props.vpc,
      vpcSubnets: props.subnets,
      instanceName: props.hostname,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.SMALL
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      requireImdsv2: true,
      ssmSessionPermissions: true,
    });

    // this will allow inbound connections on port 80, and icmp
    // We allow all outbound connections from the instance.
    this.webserver.connections.allowFromAnyIpv4(ec2.Port.tcp(80));
    this.webserver.connections.allowFromAnyIpv4(ec2.Port.allIcmp());

    // load userdata to execute on startup. This will install a NGINX webserver
    this.webserver.addUserData(
      fs.readFileSync(path.join(__dirname, "./userdata/webserver-user-data.sh"), "utf-8")
    );
    // personalise the webserver, with an customised index
    this.webserver.addUserData(
      `echo "<h1>This is ${props.hostname}.${props.r53zone.zoneName}</h1>" > /usr/share/nginx/html/index.html`
    );

    this.webserver.addUserData(`sudo hostnamectl set-hostname ${props.hostname}.${props.r53zone.zoneName}`)

    // add an A record for the webserver
    new r53.ARecord(this, 'Arecord', {
      recordName: props.hostname,
      zone: props.r53zone,
      target: r53.RecordTarget.fromIpAddresses(this.webserver.instancePrivateIp),
    })
  }
}
