import { List } from "immutable";
import { assert, expect } from "./errors";
import { mixin } from "./utils";
import Syntax from "./syntax";
import * as R from "ramda";
import TermSpec from 'sweet-spec';

const getFieldNames = R.map(f => f.attrName);

export default class Term {
  constructor(type, props) {
    if (!TermSpec.hasDescendant(type)) {
      throw new Error(`Unknown term: ${type}`);
    }
    this.type = type;
    this.loc = null;
    let propKeys = Object.keys(props);
    let fieldNames = getFieldNames(TermSpec.getDescendant(type).getAttributes());
    let diff = R.symmetricDifference(propKeys, fieldNames);
    if (diff.length !== 0) {
      throw new Error(`Unexpected properties for term ${type}: ${diff}`);
    }
    for (let prop of propKeys) {
      this[prop] = props[prop];
    }
  }

  extend(props) {
    let newProps = {};
    for (let field of TermSpec.getDescendant(this.type).getAttributes()) {
      if (props.hasOwnProperty(field.attrName)) {
        newProps[field.attrName] = props[field.attrName];
      } else {
        newProps[field.attrName] = this[field.attrName];
      }
    }
    return new Term(this.type, newProps);
  }

  gen({ includeImports } = { includeImports: true }) {
    let next = {};
    for (let field of TermSpec.getDescendant(this.type).getAttributes()) {
      if (this[field.attrName] == null) {
        next[field.attrName] = null;
      } else if (this[field.attrName] instanceof Term) {
        next[field.attrName] = this[field.attrName].gen(includeImports);
      } else if (List.isList(this[field.attrName])) {
        let pred = includeImports ? R.complement(isCompiletimeStatement) : R.both(R.complement(isImportDeclaration), R.complement(isCompiletimeStatement));
        next[field.attrName] = this[field.attrName].filter(pred)
                                 .map(term => term instanceof Term ? term.gen(includeImports) : term);
      } else {
        next[field.attrName] = this[field.attrName];
      }
    }
    return new Term(this.type, next);
  }

  visit(f) {
    let next = {};
    for (let field of TermSpec.getDescendant(this.type).getAttributes()) {
      if (this[field.attrName] == null) {
        next[field.attrName] = null;
      } else if (List.isList(this[field.attrName])) {
        next[field.attrName] = this[field.attrName].map(field => field != null ? f(field) : null);
      } else {
        next[field.attrName] = f(this[field.attrName]);
      }
    }
    return this.extend(next);
  }

  addScope(scope, bindings, phase, options) {
    return this.visit(term => {
      if (typeof term.addScope === 'function') {
        return term.addScope(scope, bindings, phase, options);
      }
      return term;
    });
  }

  removeScope(scope, phase) {
    return this.visit(term => {
      if (typeof term.removeScope === 'function') {
        return term.removeScope(scope, phase);
      }
      return term;
    });
  }

  // TODO: this is very wrong
  lineNumber() {
    for (let field of TermSpec.getDescendant(this.type).getAttributes()) {
      if (typeof this[field.attrName] && this[field.attrName].lineNumber === 'function') {
        return this[field.attrName].lineNumber();
      }
    }
  }

  setLineNumber(line) {
    let next = {};
    for (let field of TermSpec.getDescendant(this.type).getAttributes()) {
      if (this[field.attrName] == null) {
        next[field.attrName] = null;
      } else if (typeof this[field.attrName].setLineNumber === 'function') {
        next[field.attrName] = this[field.attrName].setLineNumber(line);
      } else if (List.isList(this[field.attrName])) {
        next[field.attrName] = this[field.attrName].map(f => f.setLineNumber(line));
      } else {
        next[field.attrName] = this[field.attrName];
      }
    }
    return new Term(this.type, next);
  }
}


// bindings
export const isBindingWithDefault = R.whereEq({ type: "BindingWithDefault" });
export const isBindingIdentifier = R.whereEq({ type: "BindingIdentifier" });
export const isArrayBinding = R.whereEq({ type: "ArrayBinding" });
export const isObjectBinding = R.whereEq({ type: "ObjectBinding" });
export const isBindingPropertyIdentifier = R.whereEq({ type: "BindingPropertyIdentifier" });
export const isBindingPropertyProperty = R.whereEq({ type: "BindingPropertyIdentifier" });

// class
export const isClassExpression = R.whereEq({ type: "ClassExpression" });
export const isClassDeclaration = R.whereEq({ type: "ClassDeclaration" });
export const isClassElement = R.whereEq({ type: "ClassElement" });

// modules
export const isModule = R.whereEq({ type: "Module" });
export const isImport = R.whereEq({ type: "Import" });
export const isImportNamespace = R.whereEq({ type: "ImportNamespace" });
export const isImportSpecifier = R.whereEq({ type: "ImportSpecifier" });
export const isExportAllFrom = R.whereEq({ type: "ExportAllFrom" });
export const isExportFrom = R.whereEq({ type: "ExportFrom" });
export const isExport = R.whereEq({ type: "Export" });
export const isExportDefault = R.whereEq({ type: "ExportDefault" });
export const isExportSpecifier = R.whereEq({ type: "ExportSpecifier" });

// property definition
export const isMethod = R.whereEq({ type: "Method" });
export const isGetter = R.whereEq({ type: "Getter" });
export const isSetter = R.whereEq({ type: "Setter" });
export const isDataProperty = R.whereEq({ type: "DataProperty" });
export const isShorthandProperty = R.whereEq({ type: "ShorthandProperty" });
export const isComputedPropertyName = R.whereEq({ type: "ComputedPropertyName" });
export const isStaticPropertyName = R.whereEq({ type: "StaticPropertyName" });

// literals
export const isLiteralBooleanExpression = R.whereEq({ type: "LiteralBooleanExpression" });
export const isLiteralInfinityExpression = R.whereEq({ type: "LiteralInfinityExpression" });
export const isLiteralNullExpression = R.whereEq({ type: "LiteralNullExpression" });
export const isLiteralNumericExpression = R.whereEq({ type: "LiteralNumericExpression" });
export const isLiteralRegExpExpression = R.whereEq({ type: "LiteralRegExpExpression" });
export const isLiteralStringExpression = R.whereEq({ type: "LiteralStringExpression" });

// expressions
export const isArrayExpression = R.whereEq({ type: "ArrayExpression" });
export const isArrowExpression = R.whereEq({ type: "ArrowExpression" });
export const isAssignmentExpression = R.whereEq({ type: "AssignmentExpression" });
export const isBinaryExpression = R.whereEq({ type: "BinaryExpression" });
export const isCallExpression = R.whereEq({ type: "CallExpression" });
export const isComputedAssignmentExpression = R.whereEq({ type: "ComputedAssignmentExpression" });
export const isComputedMemberExpression = R.whereEq({ type: "ComputedMemberExpression" });
export const isConditionalExpression = R.whereEq({ type: "ConditionalExpression" });
export const isFunctionExpression = R.whereEq({ type: "FunctionExpression" });
export const isIdentifierExpression = R.whereEq({ type: "IdentifierExpression" });
export const isNewExpression = R.whereEq({ type: "NewExpression" });
export const isNewTargetExpression = R.whereEq({ type: "NewTargetExpression" });
export const isObjectExpression = R.whereEq({ type: "ObjectExpression" });
export const isUnaryExpression = R.whereEq({ type: "UnaryExpression" });
export const isStaticMemberExpression = R.whereEq({ type: "StaticMemberExpression" });
export const isTemplateExpression = R.whereEq({ type: "TemplateExpression" });
export const isThisExpression = R.whereEq({ type: "ThisExpression" });
export const isUpdateExpression = R.whereEq({ type: "UpdateExpression" });
export const isYieldExpression = R.whereEq({ type: "YieldExpression" });
export const isYieldGeneratorExpression = R.whereEq({ type: "YieldGeneratorExpression" });

// statements
export const isBlockStatement = R.whereEq({ type: "BlockStatement" });
export const isBreakStatement = R.whereEq({ type: "BreakStatement" });
export const isContinueStatement = R.whereEq({ type: "ContinueStatement" });
export const isCompoundAssignmentExpression = R.whereEq({ type: "CompoundAssignmentExpression" });
export const isDebuggerStatement = R.whereEq({ type: "DebuggerStatement" });
export const isDoWhileStatement = R.whereEq({ type: "DoWhileStatement" });
export const isEmptyStatement = R.whereEq({ type: "EmptyStatement" });
export const isExpressionStatement = R.whereEq({ type: "ExpressionStatement" });
export const isForInStatement = R.whereEq({ type: "ForInStatement" });
export const isForOfStatement = R.whereEq({ type: "ForOfStatement" });
export const isForStatement = R.whereEq({ type: "ForStatement" });
export const isIfStatement = R.whereEq({ type: "IfStatement" });
export const isLabeledStatement = R.whereEq({ type: "LabeledStatement" });
export const isReturnStatement = R.whereEq({ type: "ReturnStatement" });
export const isSwitchStatement = R.whereEq({ type: "SwitchStatement" });
export const isSwitchStatementWithDefault = R.whereEq({ type: "SwitchStatementWithDefault" });
export const isThrowStatement = R.whereEq({ type: "ThrowStatement" });
export const isTryCatchStatement = R.whereEq({ type: "TryCatchStatement" });
export const isTryFinallyStatement = R.whereEq({ type: "TryFinallyStatement" });
export const isVariableDeclarationStatement = R.whereEq({ type: "VariableDeclarationStatement" });
export const isWhileStatement = R.whereEq({ type: "WhileStatement" });
export const isWithStatement = R.whereEq({ type: "WithStatement" });

// other
export const isPragma = R.whereEq({ type: 'Pragma' });
export const isBlock = R.whereEq({ type: "Block" });
export const isCatchClause = R.whereEq({ type: "CatchClause" });
export const isDirective = R.whereEq({ type: "Directive" });
export const isFormalParameters = R.whereEq({ type: "FormalParameters" });
export const isFunctionBody = R.whereEq({ type: "FunctionBody" });
export const isFunctionDeclaration = R.whereEq({ type: "FunctionDeclaration" });
export const isScript = R.whereEq({ type: "Script" });
export const isSpreadElement = R.whereEq({ type: "SpreadElement" });
export const isSuper = R.whereEq({ type: "Super" });
export const isSwitchCase = R.whereEq({ type: "SwitchCase" });
export const isSwitchDefault = R.whereEq({ type: "SwitchDefault" });
export const isTemplateElement = R.whereEq({ type: "TemplateElement" });
export const isSyntaxTemplate = R.whereEq({ type: "SyntaxTemplate" });
export const isVariableDeclaration = R.whereEq({ type: "VariableDeclaration" });
export const isVariableDeclarator = R.whereEq({ type: "VariableDeclarator" });
export const isEOF = R.whereEq({ type: 'EOF' });
export const isSyntaxDeclaration = R.both(isVariableDeclaration, R.whereEq({ kind: 'syntax' }));
export const isSyntaxrecDeclaration = R.both(isVariableDeclaration, R.whereEq({ kind: 'syntaxrec' }));
export const isFunctionTerm = R.either(isFunctionDeclaration, isFunctionExpression);
export const isFunctionWithName = R.and(isFunctionTerm, R.complement(R.where({ name: R.isNil })));
export const isParenthesizedExpression = R.whereEq({ type: 'ParenthesizedExpression'});
export const isExportSyntax = R.both(isExport, exp => R.or(isSyntaxDeclaration(exp.declaration), isSyntaxrecDeclaration(exp.declaration)));
export const isSyntaxDeclarationStatement = R.both(isVariableDeclarationStatement, decl => isCompiletimeDeclaration(decl.declaration));


export const isCompiletimeDeclaration = R.either(isSyntaxDeclaration, isSyntaxrecDeclaration);
export const isCompiletimeStatement = term => {
  return (term instanceof Term) && isVariableDeclarationStatement(term) && isCompiletimeDeclaration(term.declaration);
};
export const isImportDeclaration = R.either(isImport, isImportNamespace);
