import * as cdk from 'aws-cdk-lib';

import { 
  aws_vpclattice as vpclattice,
  aws_certificatemanager as certificatemanager,
} 
from 'aws-cdk-lib';
import * as constructs from 'constructs'

import * as lattice from './index'

export interface WeightedTargetGroup {
	readonly target: lattice.LatticeTargetGroup,
	readonly weight?: number | undefined
}

export interface LatticeListnerProps {
	readonly defaultAction: vpclattice.CfnListener.DefaultActionProperty
	readonly protocol: lattice.Protocol
	readonly port: number
	readonly serviceIdentifier: string
	readonly name: string
}

export interface HeaderMatch  {
	headername: string,
	caseSensitive?: boolean,
	matchOperator: lattice.MatchOperator,
	matchKey: string,
}

export interface PathMatch {
	pathMatchType: lattice.PathMatchType,
	matchKey: string,
	caseSensitive?: boolean,
}

export interface MethodMatch {
	httpMethod: lattice.HTTPMethods
}


export interface AddRuleProps {
	readonly name: string
	readonly action: lattice.FixedResponse | WeightedTargetGroup[]
	readonly priority: number
	readonly headerMatchs?: HeaderMatch[] | undefined
	readonly pathMatch?: PathMatch | undefined
	readonly methodMatch?: lattice.HTTPMethods | undefined	
}




// this should not get called directly, use the addListerner Method, on service network.
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

	public addListenerRule(props: AddRuleProps): void {

		// why can't i just declare this?
		let match: vpclattice.CfnRule.MatchProperty = {
			httpMatch: {
				method: 'GET',
			}
		}

		let action: vpclattice.CfnRule.ActionProperty 
		
		// if it is a fixed response
		if (typeof(props.action) === 'number') {
			action = {
				fixedResponse: {
					statusCode: props.action
				}
			}
		} else { // this is a forwarding action

			let targetGroups: vpclattice.CfnRule.WeightedTargetGroupProperty[] = []
			let requireWeight: boolean = false

			if (props.action.length > 1) {
				requireWeight = true
			}

			props.action.forEach((targetGroup) => {
				
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

		// managle the Match.	

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
									exact: props.pathMatch.matchKey
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
									prefix: props.pathMatch.matchKey
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
								exact: headerMatch.matchKey
							},
							caseSensitive: headerMatch.caseSensitive ?? false
						})
					} 
					else if (headerMatch.matchOperator === lattice.MatchOperator.CONTAINS) {
						headerMatches.push({
							name: headerMatch.headername,
							match: {
								contains: headerMatch.matchKey
							},
							caseSensitive: headerMatch.caseSensitive ?? false
						})
					}
					else if (headerMatch.matchOperator === lattice.MatchOperator.PREFIX) {
						headerMatches.push({
							name: headerMatch.headername,
							match: {
								prefix: headerMatch.matchKey
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
				
			new vpclattice.CfnRule(this, `${props.name}-Rule`,  {
				action: action,
				match: match,
				priority: props.priority,
				listenerIdentifier: this.listenerId,
			})
		}

	}
}
