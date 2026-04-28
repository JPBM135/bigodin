export interface Location {
  end: number;
  start: number;
}

export interface TextStatement {
  loc: Location;
  type: 'TEXT';
  value: string;
}

export interface CommentStatement {
  loc: Location;
  type: 'COMMENT';
  value: string;
}

export type ValueStatement = ExpressionStatement | LiteralStatement | VariableStatement;

export interface ExpressionStatement {
  hash?: Record<string, ValueStatement>;
  loc: Location;
  params: ValueStatement[];
  path: string;
  type: 'EXPRESSION';
}

export interface MustacheStatement {
  expression: ValueStatement;
  loc: Location;
  type: 'MUSTACHE';
}

export interface BlockStatement {
  elseStatements?: Statement[];
  expression: ExpressionStatement;
  isNegated: boolean;
  isNested?: boolean;
  loc: Location;
  statements: Statement[];
  type: 'BLOCK';
}

export interface TemplateStatement {
  loc: Location;
  statements: Statement[];
  type: 'TEMPLATE';
  version: number;
}

export interface LiteralStatement {
  loc: Location;
  type: 'LITERAL';
  value: boolean | number | string | null | undefined;
}

export interface VariableStatement {
  loc: Location;
  name: string;
  type: 'VARIABLE';
}

export interface AssignmentStatement {
  expression: ValueStatement;
  loc: Location;
  type: 'ASSIGNMENT';
  variable: VariableStatement;
}

export type Statement =
  | AssignmentStatement
  | BlockStatement
  | CommentStatement
  | ExpressionStatement
  | LiteralStatement
  | MustacheStatement
  | TemplateStatement
  | TextStatement
  | VariableStatement;
