import * as cdk from 'aws-cdk-lib';
import * as lattice from './index'
import * as constructs from 'constructs'

export interface AuthStatement {
	readonly effect: lattice.Effect;
	readonly principal: any | undefined;
	readonly resources: string[] | string;
	readonly conditons: any | undefined;
}

export class LatticePolicyProps {
	authStatements: AuthStatement[];
}

export class LatticePolicy extends constructs.Construct {
  
	policy: string;

	constructor(scope: constructs.Construct, id: string, props: LatticePolicyProps) {
      super(scope, id);

	  let statements: any[] = [] 
	  props.authStatements.forEach((statement) => {

		var build: any = {}
		build.Effect = statement.effect
		build.Action = 'vpc-lattice-svcs:Invoke'
		build.Resource = statement.resources
		
		if (statement.principal) {
			build.Principal = statement.principal
		}

		if (statement.conditons) {
			build.Condition = statement.conditons
		}

		statements.push(build)
	  })

	  this.policy = JSON.stringify({	
		Version: '2012-10-17',
		Statement: statements
	  })
	}
}