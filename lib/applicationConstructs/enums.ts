export enum LatticeAuthType {
	NONE = 'NONE',
	IAM = 'AWS_IAM'
}

export enum Protocol {
	HTTP = 'HTTP',
	HTTPS = 'HTTPS',
}

export enum TargetType {
  LAMBDA = 'LAMBDA',
  IP = 'IP',
  INSTANCE = 'INSTANCE',
  ALB = 'ALB'
}
