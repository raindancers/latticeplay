import * as cdk from 'aws-cdk-lib';

import { 
  aws_vpclattice as vpclattice,
  aws_certificatemanager as certificatemanager,
  aws_ram as ram,
} 
from 'aws-cdk-lib';
import * as constructs from 'constructs'

import * as lattice from './index'

/**
 * Properties for the AddListener Method
 */
export interface AddListenerProps {
	/**
	 * A name for the listener.
	 */
	name: string
	/** A default Response for the listener, if no rule matches 
	 * @default a FixedResponse of of Not Found ( 404 )
	*/
	defaultResponse?: lattice.FixedResponse | lattice.WeightedTargetGroup[] | undefined
	/**
	 * The protocol for the listener.
	 * @default HTTPS
	 */
	protocol?: lattice.Protocol | undefined
	/**
	 * The port for the listener.
	 * @default 80 or 443 depending on the protocol
	 */
	port?: number | undefined
}


export interface LatticeServiceProps {
	
	/**
	 * The authentication Type for the service.
	 * @default NONE
	 */
	readonly authType?: lattice.LatticeAuthType | undefined,
	/**
	 * Create a DNS entry in R53 for the service. 
	 */
	readonly dnsEntry?: vpclattice.CfnService.DnsEntryProperty | undefined,
	/**
	 * For HTTPS, provide a certificate from AWS ACM
	 */
	readonly certificate?: certificatemanager.Certificate | undefined
	/**
	 * a Custom domain to use for this service
	 */
	readonly customDomain?: string
	/**
	 * Tags for the service
	 */
	readonly tags?: cdk.Tag[] | undefined 
	/**
	 * Description for the service
	 */
	readonly description?: string | undefined
	/**
	 * Name for the service
	 */
	readonly name?: string | undefined
} 

/**
 * Create a Lattice Service
 */
export class LatticeService extends constructs.Construct {

	serviceId: string
	serviceArn: string
	authType: lattice.LatticeAuthType | undefined
		
	constructor(scope: constructs.Construct, id: string, props: LatticeServiceProps) {
		super(scope, id);

		// Create Tags
		let serviceTags: cdk.Tag[] = []
	
		if (props.tags) {
			serviceTags = props.tags
			if (props.description) {
				let descriptionRegEx: RegExp = /'^.{0,256}$'/;
				if (!(descriptionRegEx.test(props.description))){
					throw new Error("Service Network Descripton must be no longer than 256 characters");
				}
				serviceTags.push(new cdk.Tag('description', props.description))
			}
		}

		let certificateArn: string | undefined = undefined
		if (props.certificate) {
			certificateArn = props.certificate.certificateArn
		}

		const service = new vpclattice.CfnService(this, 'LatticeService', /* all optional props */ {
			authType: this.authType,
			certificateArn: certificateArn,
			customDomainName: props.customDomain,
			dnsEntry: props.dnsEntry,
			name: props.name,
			tags: serviceTags,
		});

		this.serviceId = service.attrId
		this.serviceArn = service.attrArn

	}


	
	/**
	 * Add a listener to the service. Using this method is the perferred way of creating a listener
	 * as there are in depth checks on the inputs. 
	 * @example
	 * const listenerOne = serviceOne.addListener({
     * name: 'serviceOneListner',
     * defaultResponse : lattice.FixedResponse.NOT_FOUND,
     * protocol: lattice.Protocol.HTTPS,
    })
	 * 
	 */
	public addListener(props: AddListenerProps): lattice.LatticeListener {
		
		// check the the port is in range if it is specificed
		if (props.port) {
			if (props.port < 0 || props.port > 65535) {
				throw new Error("Port out of range")
			}
		}

		// default to using HTTPS
		let protocol = props.protocol ?? lattice.Protocol.HTTPS 
		
		// if its not specified, set it to the default port based on the protcol
		let port: number 
		switch(protocol) {
			case lattice.Protocol.HTTP:
				port = props.port ?? 80
				break;
			case lattice.Protocol.HTTPS:
				port = props.port ?? 443
				break;
			default:
				throw new Error("Protocol not supported")
		}

		// the default action is a not found
		let defaultAction: vpclattice.CfnListener.DefaultActionProperty = { 
				fixedResponse: {
					statusCode: lattice.FixedResponse.NOT_FOUND,
				}
		}
		// Fixed Responses are numbers from the Enum
		if (props.defaultResponse) {
			if (typeof(props.defaultResponse) === 'number')  { 
				defaultAction = { 
					fixedResponse: {
						statusCode: props.defaultResponse
					}
				}
			} else {

				let targetGroups: vpclattice.CfnListener.WeightedTargetGroupProperty[] = [];
				let requireWeight: boolean = false
				
				if (props.defaultResponse.length > 1) {
					requireWeight = true
				}
				
				props.defaultResponse.forEach((targetGroup) => {

					if (requireWeight && !targetGroup.weight) {
						throw new Error("Weights are required for multiple target groups")
					}
					targetGroups.push({
						targetGroupIdentifier: targetGroup.target.targetGroupId,
						weight: targetGroup.weight ?? 100
					})
				})

				defaultAction = { 
					forward: { 
						targetGroups: targetGroups,
					}
				}
				
			}
		}

		
		const listener = new lattice.LatticeListener(this, `Listener-${props.name}`, {
			defaultAction: defaultAction,
			protocol: protocol,
			port: port,
			serviceIdentifier: this.serviceId,
			name: props.name
		  });

		  return listener

	}
	/**
	 * add an Authorization Policy to the listender
	 * @param policy 
	 */
	public addAuthPolicy(policy: lattice.LatticePolicy): void {
	
		this.authType = lattice.LatticeAuthType.IAM;
		
		new vpclattice.CfnAuthPolicy(this, 'AuthPolicy', {
			policy: policy.policy,
			resourceIdentifier: this.serviceId,
		})
	  }
	/**
	 * Share the service with other accounts/principals
	 * @param props 
	 */
	public share(props: ShareServiceProps): void {

		new ram.CfnResourceShare(this, 'ServiceNetworkShare', {
			name: props.name,
			resourceArns: [this.serviceArn],
			allowExternalPrincipals: props.allowExternalPrincipals,
			principals: props.principals
		})
	  }
	
}

export interface ShareServiceProps  {
	name: string;
	allowExternalPrincipals?: boolean | undefined
	principals?: string[] | undefined
}

