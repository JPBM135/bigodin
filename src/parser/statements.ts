export interface Location {
  end: number;
  start: number;
}

/**
 * Whitespace-control flags for a single tag, set when `~` appears just inside
 * a delimiter. `left` strips the preceding text's trailing whitespace; `right`
 * strips the following text's leading whitespace.
 */
export interface Trim {
  left?: boolean;
  right?: boolean;
}

/**
 * Whitespace-control flags for a block, whose three tags (open, close, and an
 * optional `else` divider) can each carry their own `~`.
 */
export interface BlockTrim {
  close?: Trim;
  else?: Trim;
  open?: Trim;
}

export interface TextStatement {
  loc: Location;
  type: 'TEXT';
  value: string;
}

export interface CommentStatement {
  loc: Location;
  trim?: Trim;
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
  trim?: Trim;
  type: 'MUSTACHE';
}

export interface BlockStatement {
  blockParams?: string[];
  elseStatements?: Statement[];
  expression: ExpressionStatement;
  isNegated: boolean;
  isNested?: boolean;
  loc: Location;
  statements: Statement[];
  trim?: BlockTrim;
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
  trim?: Trim;
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
