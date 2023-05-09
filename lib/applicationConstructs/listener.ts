import * as cdk from 'aws-cdk-lib';

import { 
  aws_vpclattice as vpclattice,
  aws_certificatemanager as certificatemanager,
} 
from 'aws-cdk-lib';
import * as constructs from 'constructs'

import * as lattice from './index'

/**
 * A weighted target group adds a weighting to a target group.
 * when more than one WeightedTargetGroup is provided as the action
 * for a listener, the weights are used to determine the relative proportion
 * of traffic that is sent to the target
 */
export interface WeightedTargetGroup {
	/**
	 * A target Group
	 */
	readonly target: lattice.LatticeTargetGroup,
	/**
	 * A weight for the target group. This must be supplied
	 * if there are more than one target groups for the listener	
	 * 
	 */
	readonly weight?: number | undefined
}

/**
 * 
 */
export interface LatticeListnerProps {
	/**
	 * A default action that will be taken if no rules match.
	 */
	readonly defaultAction: vpclattice.CfnListener.DefaultActionProperty
	/** 	
	 * protocol that the listener will listen on
	 */
	readonly protocol: lattice.Protocol
	/**
	 * Optional port number for the listener. If not supplied, will default to 80 or 443, depending on the Protocol
	 */
	readonly port?: number | undefined
	/**
	 * The Id of the service that this will be added to.
	 */	
	readonly serviceIdentifier: string
	/**
	 * A name for the service which shoudl be unique 
	*/
	readonly name: string
}

/**
 * Properties to Create A HeaderMatch
 */
export interface HeaderMatch  {
	/**
	 * the name of the header to match 
	 */
	headername: string,
	/**
	 * Should the match be case sensitive?
	 * @default true
	 */
	caseSensitive?: boolean,
	/**
	 * Type of match to make
	 */
	matchOperator: lattice.MatchOperator,
	/**
	 * Value to match against
	 */
	matchValue: string,
}

/**
 * Properties to create a PathMatch
 */
export interface PathMatch {
	/**
	 * Should the match be case sensitive?
	 * @default true
	 */
	caseSensitive?: boolean,
	/**
	 * Type of match to make
	 */
	pathMatchType: lattice.PathMatchType,
	/**
	 * Value to match against
	 */
	matchValue: string,
}

/**
 * Properties to create a Method Match
 */
export interface MethodMatch {
	/**
	 * An Http Method eg GET, POST, PUT, DELETE
	 */
	httpMethod: lattice.HTTPMethods
}

/**
 * Properties to add rules to to a listener
 * One of headerMatch, PathMatch, or methodMatch can be supplied,
 * the Rule can not match multiple Types 
 */
export interface AddRuleProps {
	/**
	 * A name for the the Rule
	 */
	readonly name: string
	/**
	 * the action for the rule, is either a fixed Reponse, or a being sent to  Weighted TargetGroup
	 */
	readonly action: lattice.FixedResponse | WeightedTargetGroup[]
	/**
	 * the priority of this rule, a lower priority will be processed first
	 */
	readonly priority: number
	/** Properties for a header match
	 * A header match can search for multiple headers
	 */

	readonly headerMatchs?: HeaderMatch[] | undefined
	/**
	 * Properties for a Path Match
	 */
	readonly pathMatch?: PathMatch | undefined
	/**
	 * Properties for a method Match
	 */
	readonly methodMatch?: lattice.HTTPMethods | undefined	
}



/**
 *  This class should not be called directly.
 *   Use the .addListener() Method on an instance of LatticeService
 */ 
export class LatticeListener extends constructs.Construct {

	listenerId: string
	listenerPrioritys: number[] = []
		
	constructor(scope: constructs.Construct, id: string, props: LatticeListnerProps) {
		super(scope, id);
		
		const listener = new vpclattice.CfnListener(this, `Listener-${props.name}`, {
			defaultAction: props.defaultAction,
			protocol: props.protocol,
			port: props.port,
			serviceIdentifier: props.serviceIdentifier
		  });

		  this.listenerId = listener.attrId
	}

	/**
	 * 
	 * @param props 
	 */
	public addListenerRule(props: AddRuleProps): void {

		

		/**
		 * Create the Action for the Rule
		 */ 

		let action: vpclattice.CfnRule.ActionProperty 
		
		// if the rule has a fixed response 
		if (typeof(props.action) === 'number') {
			action = {
				fixedResponse: {
					statusCode: props.action
				}
			}
		} else { // this is a forwarding action

			let targetGroups: vpclattice.CfnRule.WeightedTargetGroupProperty[] = []
			let requireWeight: boolean = false

			// If there is more than one target group check to see if all target groups
			// have a weight set
			if (props.action.length > 1) {
				requireWeight = true
			}

			// loop through the action to build a set of target groups
			props.action.forEach((targetGroup) => {
				
				// check if weight needed and throw an error if invalid
				if (requireWeight && !targetGroup.weight) {
					throw new Error("Weights are required for multiple target groups")
				}

				targetGroups.push({
					targetGroupIdentifier: targetGroup.target.targetGroupId,
					weight: targetGroup.weight ?? 100
				})
			})


			action = {
				forward: {
					targetGroups: targetGroups
				} 
			}
		}

		/**
		 * Create the Match for the rule.
		 */

		// TODO. Why do i have to set this. 
		let match: vpclattice.CfnRule.MatchProperty = {
			httpMatch: {
				method: 'GET',
			}
		}

		// check to see if a rule with this priority has already been assigned
		if (props.priority in this.listenerPrioritys) {
			throw new Error("Priority is already in use")
		}
		this.listenerPrioritys.push(props.priority)
		
		if (!(props.methodMatch || props.pathMatch || props.headerMatchs)) {
		
			throw new Error("At least one of PathMatch, headerMatch, or MethodMatch must be set")
		
		} else {
		

			let matchMethodSet: boolean = false

			// method match
			if (props.methodMatch) {
				matchMethodSet = true
				match = {
					httpMatch: {
						method: props.methodMatch,
					}
				}
			} 
			

			// path match
			if (props.pathMatch) {

				if  (matchMethodSet) {
					throw new Error(" Only one of PathMatch, headerMatch, or MethodMatch can be set")
				}
				matchMethodSet = true

				if (props.pathMatch.pathMatchType === lattice.PathMatchType.EXACT) {
					match = {
						httpMatch: {
							pathMatch : {
								match: {
									exact: props.pathMatch.matchValue
								},
								caseSensitive: props.pathMatch.caseSensitive ?? false,
							}
							
						}
					}
				}

				if (props.pathMatch.pathMatchType === lattice.PathMatchType.PREFIX) {
					match = {
						httpMatch: {
							pathMatch : {
								match: {
									prefix: props.pathMatch.matchValue
								},
								caseSensitive: props.pathMatch.caseSensitive ?? false
							}
						}
					}
				}
			}

			// header Match
			if (props.headerMatchs) {
				if (matchMethodSet) {
					throw new Error(" Only one of PathMatch, headerMatch, or MethodMatch can be set")
				}
				
				let headerMatches: vpclattice.CfnRule.HeaderMatchProperty[] = []

				props.headerMatchs.forEach((headerMatch) => {
					
					if (headerMatch.matchOperator === lattice.MatchOperator.EXACT) {
						headerMatches.push({
							name: headerMatch.headername,
							match: {
								exact: headerMatch.matchValue
							},
							caseSensitive: headerMatch.caseSensitive ?? false
						})
					} 
					else if (headerMatch.matchOperator === lattice.MatchOperator.CONTAINS) {
						headerMatches.push({
							name: headerMatch.headername,
							match: {
								contains: headerMatch.matchValue
							},
							caseSensitive: headerMatch.caseSensitive ?? false
						})
					}
					else if (headerMatch.matchOperator === lattice.MatchOperator.PREFIX) {
						headerMatches.push({
							name: headerMatch.headername,
							match: {
								prefix: headerMatch.matchValue
							},
							caseSensitive: headerMatch.caseSensitive ?? false
						})
					
					}			
				})

				match = {
					httpMatch: {
						headerMatches: headerMatches
					}
				}
			}
			// finally create a rule	
			new vpclattice.CfnRule(this, `${props.name}-Rule`,  {
				action: action,
				match: match,
				priority: props.priority,
				listenerIdentifier: this.listenerId,
			})
		}

	}
}
