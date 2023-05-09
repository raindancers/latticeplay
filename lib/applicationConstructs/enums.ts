import { isIPv6 } from "net";

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

export enum FixedResponse {
  NOT_FOUND = 404,
  OK = 200
}

export enum HTTPMethods {
  GET = 'GET',
  POST = 'POST'
}

export enum MatchOperator {
  CONTAINS = 'CONTAINS',
  EXACT = 'EXACT',
  PREFIX = 'PREFIX'
}

export enum PathMatchType {
  EXACT = 'EXACT',
  PREFIX = 'PREFIX'
}

export enum IpAddressType {
  IPV4 = 'ipv4',
  IPV6 = 'ipv6'
}

export enum ProtocolVersion {
  HTTP1 = 'HTTP1',
  HTTP2 = 'HTTP2',
  GRPC = 'GRPC'
}

export enum Action {
  ALLOW  = 'Allow',
  DENY = 'Deny'
}