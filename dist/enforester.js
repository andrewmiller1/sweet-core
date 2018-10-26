'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Enforester = undefined;

var _terms = require('./terms');

var _sweetSpec = require('sweet-spec');

var T = _interopRequireWildcard(_sweetSpec);

var _ramdaFantasy = require('ramda-fantasy');

var _scopeReducer = require('./scope-reducer');

var _scopeReducer2 = _interopRequireDefault(_scopeReducer);

var _transforms = require('./transforms');

var _immutable = require('immutable');

var _errors = require('./errors');

var _operators = require('./operators');

var _syntax = require('./syntax');

var _syntax2 = _interopRequireDefault(_syntax);

var _scope = require('./scope');

var _loadSyntax = require('./load-syntax');

var _macroContext = require('./macro-context');

var _macroContext2 = _interopRequireDefault(_macroContext);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

const Just = _ramdaFantasy.Maybe.Just;
const Nothing = _ramdaFantasy.Maybe.Nothing;

const EXPR_LOOP_OPERATOR = {};
const EXPR_LOOP_NO_CHANGE = {};
const EXPR_LOOP_EXPANSION = {};

function getLineNumber(x) {
  let stx;
  if (x instanceof _syntax2.default) {
    stx = x;
  } else if (x instanceof T.RawSyntax) {
    stx = x.value;
  } else if (x instanceof T.RawDelimiter) {
    return getLineNumber(x.inner.first());
  } else {
    throw new Error(`Not implemented yet ${x}`);
  }
  return stx.lineNumber();
}

class Enforester {

  constructor(stxl, prev, context) {
    this.done = false;
    (0, _errors.assert)(_immutable.List.isList(stxl), 'expecting a list of terms to enforest');
    (0, _errors.assert)(_immutable.List.isList(prev), 'expecting a list of terms to enforest');
    (0, _errors.assert)(context, 'expecting a context to enforest');
    this.term = null;

    this.rest = stxl;
    this.prev = prev;

    this.context = context;
  }

  peek(n = 0) {
    return this.rest.get(n);
  }

  advance() {
    let ret = this.rest.first();
    this.rest = this.rest.rest();
    return ret;
  }

  /*
   enforest works over:
   prev - a list of the previously enforest Terms
   term - the current term being enforested (initially null)
   rest - remaining Terms to enforest
   */
  enforest(type = 'Module') {
    // initialize the term
    this.term = null;

    if (this.rest.size === 0) {
      this.done = true;
      return this.term;
    }

    let result;
    if (type === 'expression') {
      result = this.enforestExpressionLoop();
    } else {
      result = this.enforestModule();
    }

    if (this.rest.size === 0) {
      this.done = true;
    }
    return result;
  }

  enforestModule() {
    return this.enforestBody();
  }

  enforestBody() {
    return this.enforestModuleItem();
  }

  enforestModuleItem() {
    let lookahead = this.peek();

    if (this.isImportTransform(lookahead)) {
      this.advance();
      return this.enforestImportDeclaration();
    } else if (this.isExportTransform(lookahead)) {
      this.advance();
      return this.enforestExportDeclaration();
    }
    return this.enforestStatement();
  }

  enforestExportDeclaration() {
    let lookahead = this.peek();
    if (this.isCompiletimeTransform(lookahead)) {
      this.expandMacro();
      lookahead = this.peek();
    }

    if (this.isPunctuator(lookahead, '*')) {
      this.advance();
      return new T.ExportAllFrom({
        moduleSpecifier: this.enforestFromClause()
      });
    } else if (this.isBraces(lookahead)) {
      let namedExports = this.enforestExportClause();
      if (this.isIdentifier(this.peek(), 'from')) {
        return new T.ExportFrom({
          namedExports: namedExports.map(s => new T.ExportFromSpecifier(s)),
          moduleSpecifier: this.enforestFromClause()
        });
      }
      return new T.ExportLocals({
        namedExports: namedExports.map(s => new T.ExportLocalSpecifier({
          name: new T.IdentifierExpression({
            name: s.name
          }),
          exportedName: s.exportedName
        }))
      });
    } else if (this.isClassTransform(lookahead)) {
      return new T.Export({
        declaration: this.enforestClass({
          isExpr: false
        })
      });
    } else if (this.isFnDeclTransform(lookahead)) {
      return new T.Export({
        declaration: this.enforestFunction({
          isExpr: false
        })
      });
    } else if (this.isAsyncTransform(lookahead) && this.isFnDeclTransform(this.peek(1)) && this.lineNumberEq(lookahead, this.peek(1))) {
      this.advance();
      return new T.Export({
        declaration: this.enforestFunction({
          isExpr: false,
          isAsync: true
        })
      });
    } else if (this.isDefaultTransform(lookahead)) {
      this.advance();
      if (this.isCompiletimeTransform(lookahead)) {
        this.expandMacro();
        lookahead = this.peek();
      }

      if (this.isFnDeclTransform(this.peek())) {
        return new T.ExportDefault({
          body: this.enforestFunction({
            isExpr: false,
            inDefault: true
          })
        });
      } else if (this.isAsyncTransform(lookahead) && this.isFnDeclTransform(this.peek(1)) && this.lineNumberEq(lookahead, this.peek(1))) {
        this.advance();
        return new T.ExportDefault({
          body: this.enforestFunction({
            isExpr: false,
            inDefault: true,
            isAsync: true
          })
        });
      } else if (this.isClassTransform(this.peek())) {
        return new T.ExportDefault({
          body: this.enforestClass({
            isExpr: false,
            inDefault: true
          })
        });
      } else {
        let body = this.enforestExpressionLoop();
        this.consumeSemicolon();
        return new T.ExportDefault({
          body
        });
      }
    } else if (this.isVarDeclTransform(lookahead) || this.isLetDeclTransform(lookahead) || this.isConstDeclTransform(lookahead) || this.isSyntaxrecDeclTransform(lookahead) || this.isSyntaxDeclTransform(lookahead) || this.isOperatorDeclTransform(lookahead)) {
      return new T.Export({
        declaration: this.enforestVariableDeclaration()
      });
    }
    throw this.createError(lookahead, 'unexpected syntax');
  }

  enforestExportClause() {
    let enf = new Enforester(this.matchCurlies(), (0, _immutable.List)(), this.context);
    let result = [];
    while (enf.rest.size !== 0) {
      result.push(enf.enforestExportSpecifier());
      enf.consumeComma();
    }
    return (0, _immutable.List)(result);
  }

  enforestExportSpecifier() {
    const name = this.enforestIdentifier();
    let exportedName = null;
    if (this.isIdentifier(this.peek(), 'as')) {
      this.advance();
      exportedName = this.enforestIdentifier();
    }
    return {
      name,
      exportedName
    };
  }

  enforestImportDeclaration() {
    let lookahead = this.peek();
    let defaultBinding = null;
    let namedImports = (0, _immutable.List)();
    let forSyntax = false;

    if (this.isStringLiteral(lookahead)) {
      let moduleSpecifier = this.advance();
      this.consumeSemicolon();
      return new T.Import({
        defaultBinding,
        namedImports,
        moduleSpecifier,
        forSyntax
      });
    }

    if (this.isIdentifier(lookahead) || this.isKeyword(lookahead)) {
      defaultBinding = this.enforestBindingIdentifier();
      if (!this.isPunctuator(this.peek(), ',')) {
        let moduleSpecifier = this.enforestFromClause();
        if (this.isKeyword(this.peek(), 'for') && this.isIdentifier(this.peek(1), 'syntax')) {
          this.advance();
          this.advance();
          forSyntax = true;
        }

        return new T.Import({
          defaultBinding,
          moduleSpecifier,
          namedImports: (0, _immutable.List)(),
          forSyntax
        });
      }
    }
    this.consumeComma();
    lookahead = this.peek();
    if (this.isBraces(lookahead)) {
      let imports = this.enforestNamedImports();
      let fromClause = this.enforestFromClause();
      if (this.isKeyword(this.peek(), 'for') && this.isIdentifier(this.peek(1), 'syntax')) {
        this.advance();
        this.advance();
        forSyntax = true;
      }

      return new T.Import({
        defaultBinding,
        forSyntax,
        namedImports: imports,
        moduleSpecifier: fromClause
      });
    } else if (this.isPunctuator(lookahead, '*')) {
      let namespaceBinding = this.enforestNamespaceBinding();
      let moduleSpecifier = this.enforestFromClause();
      if (this.isKeyword(this.peek(), 'for') && this.isIdentifier(this.peek(1), 'syntax')) {
        this.advance();
        this.advance();
        forSyntax = true;
      }
      return new T.ImportNamespace({
        defaultBinding,
        forSyntax,
        namespaceBinding,
        moduleSpecifier
      });
    }
    throw this.createError(lookahead, 'unexpected syntax');
  }

  enforestNamespaceBinding() {
    this.matchPunctuator('*');
    this.matchIdentifier('as');
    return this.enforestBindingIdentifier();
  }

  enforestNamedImports() {
    let enf = new Enforester(this.matchCurlies(), (0, _immutable.List)(), this.context);
    let result = [];
    while (enf.rest.size !== 0) {
      result.push(enf.enforestImportSpecifiers());
      enf.consumeComma();
    }
    return (0, _immutable.List)(result);
  }

  enforestImportSpecifiers() {
    let lookahead = this.peek();
    let name;
    if (this.isIdentifier(lookahead) || this.isKeyword(lookahead) || this.isPunctuator(lookahead)) {
      name = this.matchRawSyntax();
      if (!this.isIdentifier(this.peek(), 'as')) {
        return new T.ImportSpecifier({
          name: null,
          binding: new T.BindingIdentifier({
            name: name
          })
        });
      } else {
        this.matchIdentifier('as');
      }
    } else {
      throw this.createError(lookahead, 'unexpected token in import specifier');
    }
    return new T.ImportSpecifier({
      name,
      binding: this.enforestBindingIdentifier()
    });
  }

  enforestFromClause() {
    this.matchIdentifier('from');
    let lookahead = this.matchStringLiteral();
    this.consumeSemicolon();
    return lookahead;
  }

  enforestStatementListItem() {
    let lookahead = this.peek();

    if (this.isFnDeclTransform(lookahead)) {
      return this.enforestFunction({
        isExpr: false
      });
    } else if (this.isAsyncTransform(lookahead) && this.isFnDeclTransform(this.peek(1)) && this.lineNumberEq(lookahead, this.peek(1))) {
      this.advance();
      return this.enforestFunction({
        isExpr: false,
        isAsync: true
      });
    } else if (this.isClassTransform(lookahead)) {
      return this.enforestClass({
        isExpr: false
      });
    } else {
      return this.enforestStatement();
    }
  }

  enforestStatement() {
    let lookahead = this.peek();

    if (this.term === null && this.isCompiletimeTransform(lookahead)) {
      this.expandMacro();
      lookahead = this.peek();
    }

    if (this.term === null && this.isTerm(lookahead) && lookahead instanceof T.Statement) {
      // TODO: check that this is actually an statement
      return this.advance();
    }

    if (this.term === null && this.isBraces(lookahead)) {
      return this.enforestBlockStatement();
    }

    if (this.term === null && this.isWhileTransform(lookahead)) {
      return this.enforestWhileStatement();
    }

    if (this.term === null && this.isIfTransform(lookahead)) {
      return this.enforestIfStatement();
    }
    if (this.term === null && this.isForTransform(lookahead)) {
      return this.enforestForStatement();
    }
    if (this.term === null && this.isSwitchTransform(lookahead)) {
      return this.enforestSwitchStatement();
    }
    if (this.term === null && this.isBreakTransform(lookahead)) {
      return this.enforestBreakStatement();
    }
    if (this.term === null && this.isContinueTransform(lookahead)) {
      return this.enforestContinueStatement();
    }
    if (this.term === null && this.isDoTransform(lookahead)) {
      return this.enforestDoStatement();
    }
    if (this.term === null && this.isDebuggerTransform(lookahead)) {
      return this.enforestDebuggerStatement();
    }
    if (this.term === null && this.isWithTransform(lookahead)) {
      return this.enforestWithStatement();
    }
    if (this.term === null && this.isTryTransform(lookahead)) {
      return this.enforestTryStatement();
    }
    if (this.term === null && this.isThrowTransform(lookahead)) {
      return this.enforestThrowStatement();
    }

    // TODO: put somewhere else
    if (this.term === null && this.isKeyword(lookahead, 'class')) {
      return this.enforestClass({
        isExpr: false
      });
    }

    if (this.term === null && this.isFnDeclTransform(lookahead)) {
      return this.enforestFunction({
        isExpr: false
      });
    }

    if (this.term === null && this.isAsyncTransform(lookahead) && this.isFnDeclTransform(this.peek(1)) && this.lineNumberEq(lookahead, this.peek(1))) {
      this.advance();
      return this.enforestFunction({
        isExpr: false,
        isAsync: true
      });
    }

    if (this.term === null && this.isIdentifier(lookahead) && this.isPunctuator(this.peek(1), ':')) {
      return this.enforestLabeledStatement();
    }

    if (this.term === null && (this.isVarDeclTransform(lookahead) || this.isLetDeclTransform(lookahead) || this.isConstDeclTransform(lookahead) || this.isSyntaxrecDeclTransform(lookahead) || this.isSyntaxDeclTransform(lookahead) || this.isOperatorDeclTransform(lookahead))) {
      let stmt = new T.VariableDeclarationStatement({
        declaration: this.enforestVariableDeclaration()
      });
      this.consumeSemicolon();
      return stmt;
    }

    if (this.term === null && this.isReturnStmtTransform(lookahead)) {
      return this.enforestReturnStatement();
    }

    if (this.term === null && this.isPunctuator(lookahead, ';')) {
      this.advance();
      return new T.EmptyStatement({});
    }

    return this.enforestExpressionStatement();
  }

  enforestLabeledStatement() {
    let label = this.matchIdentifier();
    this.matchPunctuator(':');
    let stmt = this.enforestStatement();

    return new T.LabeledStatement({
      label: label,
      body: stmt
    });
  }

  enforestBreakStatement() {
    this.matchKeyword('break');
    let lookahead = this.peek();
    let label = null;
    if (this.rest.size === 0 || this.isPunctuator(lookahead, ';')) {
      this.consumeSemicolon();
      return new T.BreakStatement({
        label
      });
    }
    if (this.isIdentifier(lookahead) || this.isKeyword(lookahead, 'yield') || this.isKeyword(lookahead, 'let')) {
      label = this.enforestIdentifier();
    }
    this.consumeSemicolon();

    return new T.BreakStatement({
      label
    });
  }

  enforestTryStatement() {
    this.matchKeyword('try');
    let body = this.enforestBlock();
    if (this.isKeyword(this.peek(), 'catch')) {
      let catchClause = this.enforestCatchClause();
      if (this.isKeyword(this.peek(), 'finally')) {
        this.advance();
        let finalizer = this.enforestBlock();
        return new T.TryFinallyStatement({
          body,
          catchClause,
          finalizer
        });
      }
      return new T.TryCatchStatement({
        body,
        catchClause
      });
    }
    if (this.isKeyword(this.peek(), 'finally')) {
      this.advance();
      let finalizer = this.enforestBlock();
      return new T.TryFinallyStatement({
        body,
        catchClause: null,
        finalizer
      });
    }
    throw this.createError(this.peek(), 'try with no catch or finally');
  }

  enforestCatchClause() {
    this.matchKeyword('catch');
    let bindingParens = this.matchParens();
    let enf = new Enforester(bindingParens, (0, _immutable.List)(), this.context);
    let binding = enf.enforestBindingTarget();
    let body = this.enforestBlock();
    return new T.CatchClause({
      binding,
      body
    });
  }

  enforestThrowStatement() {
    this.matchKeyword('throw');
    let expression = this.enforestExpression();
    this.consumeSemicolon();
    return new T.ThrowStatement({
      expression
    });
  }

  enforestWithStatement() {
    this.matchKeyword('with');
    let objParens = this.matchParens();
    let enf = new Enforester(objParens, (0, _immutable.List)(), this.context);
    let object = enf.enforestExpression();
    let body = this.enforestStatement();
    return new T.WithStatement({
      object,
      body
    });
  }

  enforestDebuggerStatement() {
    this.matchKeyword('debugger');

    return new T.DebuggerStatement({});
  }

  enforestDoStatement() {
    this.matchKeyword('do');
    let body = this.enforestStatement();
    this.matchKeyword('while');
    let testBody = this.matchParens();
    let enf = new Enforester(testBody, (0, _immutable.List)(), this.context);
    let test = enf.enforestExpression();
    this.consumeSemicolon();
    return new T.DoWhileStatement({
      body,
      test
    });
  }

  enforestContinueStatement() {
    let kwd = this.matchKeyword('continue');
    let lookahead = this.peek();
    let label = null;
    if (this.rest.size === 0 || this.isPunctuator(lookahead, ';')) {
      this.consumeSemicolon();
      return new T.ContinueStatement({
        label
      });
    }
    if (lookahead instanceof T.RawSyntax && this.lineNumberEq(kwd, lookahead) && (this.isIdentifier(lookahead) || this.isKeyword(lookahead, 'yield') || this.isKeyword(lookahead, 'let'))) {
      label = this.enforestIdentifier();
    }
    this.consumeSemicolon();

    return new T.ContinueStatement({
      label
    });
  }

  enforestSwitchStatement() {
    this.matchKeyword('switch');
    let cond = this.matchParens();
    let enf = new Enforester(cond, (0, _immutable.List)(), this.context);
    let discriminant = enf.enforestExpression();
    let body = this.matchCurlies();

    if (body.size === 0) {
      return new T.SwitchStatement({
        discriminant: discriminant,
        cases: (0, _immutable.List)()
      });
    }
    enf = new Enforester(body, (0, _immutable.List)(), this.context);
    let cases = enf.enforestSwitchCases();
    let lookahead = enf.peek();
    if (enf.isKeyword(lookahead, 'default')) {
      let defaultCase = enf.enforestSwitchDefault();
      let postDefaultCases = enf.enforestSwitchCases();
      return new T.SwitchStatementWithDefault({
        discriminant,
        preDefaultCases: cases,
        defaultCase,
        postDefaultCases
      });
    }
    return new T.SwitchStatement({
      discriminant,
      cases
    });
  }

  enforestSwitchCases() {
    let cases = [];
    while (!(this.rest.size === 0 || this.isKeyword(this.peek(), 'default'))) {
      cases.push(this.enforestSwitchCase());
    }
    return (0, _immutable.List)(cases);
  }

  enforestSwitchCase() {
    this.matchKeyword('case');
    return new T.SwitchCase({
      test: this.enforestExpression(),
      consequent: this.enforestSwitchCaseBody()
    });
  }

  enforestSwitchCaseBody() {
    this.matchPunctuator(':');
    return this.enforestStatementListInSwitchCaseBody();
  }

  enforestStatementListInSwitchCaseBody() {
    let result = [];
    while (!(this.rest.size === 0 || this.isKeyword(this.peek(), 'default') || this.isKeyword(this.peek(), 'case'))) {
      result.push(this.enforestStatementListItem());
    }
    return (0, _immutable.List)(result);
  }

  enforestSwitchDefault() {
    this.matchKeyword('default');
    return new T.SwitchDefault({
      consequent: this.enforestSwitchCaseBody()
    });
  }

  enforestForStatement() {
    this.matchKeyword('for');
    let cond = this.matchParens();
    let enf = new Enforester(cond, (0, _immutable.List)(), this.context);
    let lookahead, test, init, right, left, update, cnst;

    // case where init is null
    if (enf.isPunctuator(enf.peek(), ';')) {
      enf.advance();
      if (!enf.isPunctuator(enf.peek(), ';')) {
        test = enf.enforestExpression();
      }
      enf.matchPunctuator(';');
      if (enf.rest.size !== 0) {
        right = enf.enforestExpression();
      }
      return new T.ForStatement({
        init: null,
        test: test,
        update: right,
        body: this.enforestStatement()
      });
      // case where init is not null
    } else {
      // testing
      lookahead = enf.peek();
      if (enf.isVarDeclTransform(lookahead) || enf.isLetDeclTransform(lookahead) || enf.isConstDeclTransform(lookahead)) {
        init = enf.enforestVariableDeclaration();
        lookahead = enf.peek();
        if (this.isKeyword(lookahead, 'in') || this.isIdentifier(lookahead, 'of')) {
          if (this.isKeyword(lookahead, 'in')) {
            enf.advance();
            right = enf.enforestExpression();
            cnst = T.ForInStatement;
          } else {
            (0, _errors.assert)(this.isIdentifier(lookahead, 'of'), 'expecting `of` keyword');
            enf.advance();
            right = enf.enforestExpression();
            cnst = T.ForOfStatement;
          }
          return new cnst({
            left: init,
            right,
            body: this.enforestStatement()
          });
        }
        enf.matchPunctuator(';');
        if (enf.isPunctuator(enf.peek(), ';')) {
          enf.advance();
          test = null;
        } else {
          test = enf.enforestExpression();
          enf.matchPunctuator(';');
        }
        update = enf.enforestExpression();
      } else {
        if (this.isKeyword(enf.peek(1), 'in') || this.isIdentifier(enf.peek(1), 'of')) {
          left = enf.enforestBindingIdentifier();
          let kind = enf.advance();
          if (this.isKeyword(kind, 'in')) {
            cnst = T.ForInStatement;
          } else {
            left = this.transformDestructuring(left);
            cnst = T.ForOfStatement;
          }
          right = enf.enforestExpression();
          return new cnst({
            left: left,
            right,
            body: this.enforestStatement()
          });
        }
        init = enf.enforestExpression();
        enf.matchPunctuator(';');
        if (enf.isPunctuator(enf.peek(), ';')) {
          enf.advance();
          test = null;
        } else {
          test = enf.enforestExpression();
          enf.matchPunctuator(';');
        }
        update = enf.enforestExpression();
      }
      return new T.ForStatement({
        init,
        test,
        update,
        body: this.enforestStatement()
      });
    }
  }

  enforestIfStatement() {
    this.matchKeyword('if');
    let cond = this.matchParens();
    let enf = new Enforester(cond, (0, _immutable.List)(), this.context);
    let lookahead = enf.peek();
    let test = enf.enforestExpression();
    if (test === null) {
      throw enf.createError(lookahead, 'expecting an expression');
    }
    let consequent = this.enforestStatement();
    let alternate = null;
    if (this.isKeyword(this.peek(), 'else')) {
      this.advance();
      alternate = this.enforestStatement();
    }
    return new T.IfStatement({
      test,
      consequent,
      alternate
    });
  }

  enforestWhileStatement() {
    this.matchKeyword('while');
    let cond = this.matchParens();
    let enf = new Enforester(cond, (0, _immutable.List)(), this.context);
    let lookahead = enf.peek();
    let test = enf.enforestExpression();
    if (test === null) {
      throw enf.createError(lookahead, 'expecting an expression');
    }
    let body = this.enforestStatement();

    return new T.WhileStatement({
      test,
      body
    });
  }

  enforestBlockStatement() {
    return new T.BlockStatement({
      block: this.enforestBlock()
    });
  }

  enforestBlock() {
    return new T.Block({
      statements: this.matchCurlies()
    });
  }

  enforestClass({
    isExpr = false,
    inDefault = false
  }) {
    let kw = this.matchRawSyntax();
    let name = null,
        supr = null;

    if (this.isIdentifier(this.peek())) {
      name = this.enforestBindingIdentifier();
    } else if (!isExpr) {
      if (inDefault) {
        name = new T.BindingIdentifier({
          name: _syntax2.default.fromIdentifier('_default', kw)
        });
      } else {
        throw this.createError(this.peek(), 'unexpected syntax');
      }
    }

    if (this.isKeyword(this.peek(), 'extends')) {
      this.advance();
      supr = this.enforestExpressionLoop();
    }

    let elements = [];
    let enf = new Enforester(this.matchCurlies(), (0, _immutable.List)(), this.context);
    while (enf.rest.size !== 0) {
      if (enf.isPunctuator(enf.peek(), ';')) {
        enf.advance();
        continue;
      }

      let isStatic = false;
      let { methodOrKey, kind } = enf.enforestMethodDefinition();
      if (kind === 'identifier' && methodOrKey instanceof T.StaticPropertyName && methodOrKey.value.val() === 'static') {
        isStatic = true;
        ({ methodOrKey, kind } = enf.enforestMethodDefinition());
      }
      if (kind === 'method') {
        elements.push(new T.ClassElement({
          isStatic,
          method: methodOrKey
        }));
      } else {
        throw this.createError(enf.peek(), 'Only methods are allowed in classes');
      }
    }
    return new (isExpr ? T.ClassExpression : T.ClassDeclaration)({
      name,
      super: supr,
      elements: (0, _immutable.List)(elements)
    });
  }

  enforestBindingTarget({
    allowPunctuator = false
  } = {}) {
    let lookahead = this.peek();
    if (this.isIdentifier(lookahead) || this.isKeyword(lookahead) || allowPunctuator && this.isPunctuator(lookahead)) {
      return this.enforestBindingIdentifier({
        allowPunctuator
      });
    } else if (this.isBrackets(lookahead)) {
      return this.enforestArrayBinding();
    } else if (this.isBraces(lookahead)) {
      return this.enforestObjectBinding();
    }
    (0, _errors.assert)(false, 'not implemented yet');
  }

  enforestObjectBinding() {
    let enf = new Enforester(this.matchCurlies(), (0, _immutable.List)(), this.context);
    let properties = [];

    //TODO: implement object rest operator when it lands
    while (enf.rest.size !== 0) {
      properties.push(enf.enforestBindingProperty());

      if (enf.rest.size > 0 && !enf.isPunctuator(enf.peek(), ',')) {
        throw enf.createError(enf.peek(), 'unexpected token');
      }

      enf.consumeComma();
    }

    return new T.ObjectBinding({
      properties: (0, _immutable.List)(properties)
    });
  }

  enforestBindingProperty() {
    let lookahead = this.peek();
    let { name, binding } = this.enforestPropertyName();
    if (this.isIdentifier(lookahead) || this.isKeyword(lookahead, 'let') || this.isKeyword(lookahead, 'yield')) {
      if (!this.isPunctuator(this.peek(), ':')) {
        if (this.isAssign(this.peek())) {
          this.advance();
          let expr = this.enforestExpressionLoop();
          return new T.BindingPropertyProperty({
            name,
            binding: new T.BindingWithDefault({
              binding,
              init: expr
            })
          });
        }
        return new T.BindingPropertyProperty({
          name,
          binding
        });
      }
    }
    this.matchPunctuator(':');
    binding = this.enforestBindingElement();
    return new T.BindingPropertyProperty({
      name,
      binding
    });
  }

  enforestArrayBinding() {
    let bracket = this.matchSquares();
    let enf = new Enforester(bracket, (0, _immutable.List)(), this.context);
    let elements = [],
        rest = null;
    while (enf.rest.size !== 0) {
      let el = null;
      if (!enf.isPunctuator(enf.peek(), ',')) {
        if (enf.isPunctuator(enf.peek(), '...')) {
          enf.advance();
          rest = enf.enforestBindingTarget();
          if (enf.rest.size > 0) {
            throw enf.createError(enf.rest.first(), 'Rest element must be last element in array');
          }
        } else {
          el = enf.enforestBindingElement();

          if (el == null) {
            throw enf.createError(enf.peek(), 'expected expression');
          }
          if (enf.rest.size > 0 && !enf.isPunctuator(enf.peek(), ',')) {
            throw enf.createError(enf.peek(), 'unexpected token');
          }
        }
      }
      if (rest == null) {
        elements.push(el);
        enf.consumeComma();
      }
    }
    return new T.ArrayBinding({
      elements: (0, _immutable.List)(elements),
      rest
    });
  }

  enforestBindingElement() {
    let binding = this.enforestBindingTarget();

    if (this.isAssign(this.peek())) {
      this.advance();
      let init = this.enforestExpressionLoop();
      binding = new T.BindingWithDefault({
        binding,
        init
      });
    }
    return binding;
  }

  enforestBindingIdentifier({
    allowPunctuator
  } = {}) {
    let name;
    if (allowPunctuator && this.isPunctuator(this.peek())) {
      name = this.enforestPunctuator();
    } else {
      name = this.enforestIdentifier();
    }
    return new T.BindingIdentifier({
      name
    });
  }

  enforestPunctuator() {
    let lookahead = this.peek();
    if (this.isPunctuator(lookahead)) {
      return this.matchRawSyntax();
    }
    throw this.createError(lookahead, 'expecting a punctuator');
  }

  enforestIdentifier() {
    let lookahead = this.peek();
    if (this.isIdentifier(lookahead) || this.isKeyword(lookahead)) {
      return this.matchRawSyntax();
    }
    throw this.createError(lookahead, 'expecting an identifier');
  }

  enforestReturnStatement() {
    let kw = this.matchRawSyntax();
    let lookahead = this.peek();

    // short circuit for the empty expression case
    if (this.rest.size === 0 || lookahead && !this.lineNumberEq(kw, lookahead)) {
      return new T.ReturnStatement({
        expression: null
      });
    }

    let term = null;
    if (!this.isPunctuator(lookahead, ';')) {
      term = this.enforestExpression();
      (0, _errors.expect)(term != null, 'Expecting an expression to follow return keyword', lookahead, this.rest);
    }

    this.consumeSemicolon();
    return new T.ReturnStatement({
      expression: term
    });
  }

  enforestVariableDeclaration() {
    let kind;
    let lookahead = this.advance();

    if (this.isVarDeclTransform(lookahead)) {
      kind = 'var';
    } else if (this.isLetDeclTransform(lookahead)) {
      kind = 'let';
    } else if (this.isConstDeclTransform(lookahead)) {
      kind = 'const';
    } else if (this.isSyntaxDeclTransform(lookahead)) {
      kind = 'syntax';
    } else if (this.isSyntaxrecDeclTransform(lookahead)) {
      kind = 'syntaxrec';
    } else if (this.isOperatorDeclTransform(lookahead)) {
      kind = 'operator';
    }

    let decls = (0, _immutable.List)();

    while (true) {
      let term = this.enforestVariableDeclarator({
        isSyntax: kind === 'syntax' || kind === 'syntaxrec' || kind === 'operator',
        isOperator: kind === 'operator'
      });
      let lookahead = this.peek();
      // TODO: bug in immutable type definitions for concat,
      // upgrade to v4 when it is released
      // https://github.com/facebook/immutable-js/pull/1153
      decls = decls.concat(term);

      if (this.isPunctuator(lookahead, ',')) {
        this.advance();
      } else {
        break;
      }
    }

    return new T.VariableDeclaration({
      kind: kind,
      declarators: decls
    });
  }

  enforestVariableDeclarator({
    isSyntax,
    isOperator
  }) {
    let id = this.enforestBindingTarget({
      allowPunctuator: isSyntax
    });
    const AssocValues = ['left', 'right', 'prefix', 'postfix'];

    let assoc, prec;
    if (isOperator) {
      assoc = this.matchIdentifier();
      if (AssocValues.indexOf(assoc.val()) === -1) {
        throw this.createError(this.peek(), `Associativity must be one of ${AssocValues.join(',')}`);
      }
      prec = this.matchLiteral();
    }

    let init;
    if (this.isPunctuator(this.peek(), '=')) {
      this.advance();
      let enf = new Enforester(this.rest, (0, _immutable.List)(), this.context);
      init = enf.enforest('expression');
      this.rest = enf.rest;
    } else {
      init = null;
    }

    if (isOperator) {
      return new T.OperatorDeclarator({
        binding: id,
        init,
        prec,
        assoc
      });
    }
    return new T.VariableDeclarator({
      binding: id,
      init: init
    });
  }

  enforestExpressionStatement() {
    let start = this.rest.get(0);
    let expr = this.enforestExpression();
    if (expr === null) {
      throw this.createError(start, 'not a valid expression');
    }
    this.consumeSemicolon();

    return new T.ExpressionStatement({
      expression: expr
    });
  }

  enforestExpression() {
    let left = this.enforestExpressionLoop();
    let lookahead = this.peek();
    if (this.isPunctuator(lookahead, ',')) {
      while (this.rest.size !== 0) {
        if (!this.isPunctuator(this.peek(), ',')) {
          break;
        }
        let operator = this.matchRawSyntax();
        let right = this.enforestExpressionLoop();
        left = new T.BinaryExpression({
          left,
          operator: operator.val(),
          right
        });
      }
    }
    this.term = null;
    return left;
  }

  enforestExpressionLoop() {
    this.term = null;
    this.opCtx = {
      prec: 0,
      combine: x => x,
      stack: (0, _immutable.List)()
    };

    do {
      let term = this.enforestAssignmentExpression();
      // no change means we've done as much enforesting as possible
      // if nothing changed, maybe we just need to pop the expr stack
      if (term === EXPR_LOOP_NO_CHANGE && this.opCtx.stack.size > 0) {
        this.term = this.opCtx.combine(this.term);
        let { prec, combine } = this.opCtx.stack.last();
        this.opCtx.prec = prec;
        this.opCtx.combine = combine;
        this.opCtx.stack = this.opCtx.stack.pop();
      } else if (term === EXPR_LOOP_NO_CHANGE) {
        break;
      } else if (term === EXPR_LOOP_OPERATOR || term === EXPR_LOOP_EXPANSION) {
        // operator means an opCtx was pushed on the stack
        this.term = null;
      } else {
        this.term = term; // TODO: don't overload the term's type with EXPR_LOOP_OPERATOR etc.
      }
    } while (true); // get a fixpoint
    return this.term;
  }

  enforestAssignmentExpression() {
    let lookahead = this.peek();

    if (this.term === null && this.isModuleNamespaceTransform(lookahead)) {
      // $FlowFixMe: we need to refactor the enforester to make flow work better
      let namespace = this.getFromCompiletimeEnvironment(this.advance().value);
      this.matchPunctuator('.');
      let name = this.matchIdentifier();
      // $FlowFixMe: we need to refactor the enforester to make flow work better
      let exportedName = namespace.mod.exportedNames.find(exName => exName.exportedName.val() === name.val());
      this.rest = this.rest.unshift(new T.RawSyntax({
        value: _syntax2.default.fromIdentifier(name.val(), exportedName.exportedName)
      }));
      lookahead = this.peek();
    }

    if (this.term === null && this.isCompiletimeTransform(lookahead)) {
      this.expandMacro();
      lookahead = this.peek();
    }

    if (this.term === null && this.isTerm(lookahead) && lookahead instanceof T.Expression) {
      // TODO: check that this is actually an expression
      return this.advance();
    }

    if (this.term === null && this.isYieldTransform(lookahead)) {
      return this.enforestYieldExpression();
    }

    if (this.term === null && this.isClassTransform(lookahead)) {
      return this.enforestClass({
        isExpr: true
      });
    }

    if (this.term === null && this.isAsyncTransform(this.peek()) && (this.isIdentifier(this.peek(1)) || this.isParens(this.peek(1))) && this.isPunctuator(this.peek(2), '=>') && this.lineNumberEq(this.peek(0), this.peek(1)) && this.lineNumberEq(this.peek(1), this.peek(2))) {
      this.advance();
      return this.enforestArrowExpression({
        isAsync: true
      });
    }

    if (this.term === null && lookahead && (this.isIdentifier(lookahead) || this.isParens(lookahead)) && this.isPunctuator(this.peek(1), '=>') && this.lineNumberEq(lookahead, this.peek(1))) {
      return this.enforestArrowExpression({ isAsync: false });
    }

    if (this.term === null && this.isSyntaxTemplate(lookahead)) {
      return this.enforestSyntaxTemplate();
    }

    // ($x:expr)
    if (this.term === null && this.isParens(lookahead)) {
      return new T.ParenthesizedExpression({
        inner: this.matchParens()
      });
    }

    if (this.term === null && (this.isKeyword(lookahead, 'this') || this.isIdentifier(lookahead) && !this.isIdentifier(lookahead, 'await') || this.isKeyword(lookahead, 'let') || this.isKeyword(lookahead, 'yield') || this.isNumericLiteral(lookahead) || this.isStringLiteral(lookahead) || this.isTemplate(lookahead) || this.isBooleanLiteral(lookahead) || this.isNullLiteral(lookahead) || this.isRegularExpression(lookahead) || this.isFnDeclTransform(lookahead) || this.isAsyncTransform(lookahead) || this.isBraces(lookahead) || this.isBrackets(lookahead))) {
      return this.enforestPrimaryExpression();
    }

    // prefix unary
    if (this.term === null && (this.isOperator(lookahead) || this.isCustomPrefixOperator(lookahead))) {
      return this.enforestUnaryExpression();
    }

    if (this.term === null && this.isVarBindingTransform(lookahead) && lookahead instanceof T.RawSyntax) {
      let lookstx = lookahead.value;
      // $FlowFixMe
      let id = this.getFromCompiletimeEnvironment(lookstx).id;
      if (id !== lookstx) {
        this.advance();
        this.rest = _immutable.List.of(id).concat(this.rest);
        return EXPR_LOOP_EXPANSION;
      }
    }

    if (this.term === null && (this.isNewTransform(lookahead) || this.isSuperTransform(lookahead)) ||
    // and then check the cases where the term part of p is something...
    this.term && (
    // $x:expr . $prop:ident
    this.isPunctuator(lookahead, '.') && (this.isIdentifier(this.peek(1)) || this.isKeyword(this.peek(1))) ||
    // $x:expr [ $b:expr ]
    this.isBrackets(lookahead) ||
    // $x:expr (...)
    this.isParens(lookahead))) {
      return this.enforestLeftHandSideExpression({
        allowCall: true
      });
    }

    // $l:expr $op:binaryOperator $r:expr
    if (this.term && this.isCustomBinaryOperator(lookahead)) {
      return this.enforestBinaryExpression();
    }

    // postfix unary
    if (this.term && (this.isUpdateOperator(lookahead) || this.isCustomPostfixOperator(lookahead))) {
      return this.enforestUpdateExpression();
    }

    // $l:expr $op:binaryOperator $r:expr
    if (this.term && (this.isOperator(lookahead) || this.isCustomBinaryOperator(lookahead))) {
      return this.enforestBinaryExpression();
    }

    // $x:id `...`
    if (this.term && this.isTemplate(lookahead)) {
      return this.enforestTemplateLiteral();
    }

    // $x:expr = $init:expr
    if (this.term && this.isAssign(lookahead)) {
      let binding = this.transformDestructuring(this.term);
      let op = this.matchRawSyntax();

      let enf = new Enforester(this.rest, (0, _immutable.List)(), this.context);
      let init = enf.enforest('expression');
      this.rest = enf.rest;

      if (op.val() === '=') {
        return new T.AssignmentExpression({
          binding,
          expression: init
        });
      } else {
        return new T.CompoundAssignmentExpression({
          binding,
          operator: op.val(),
          expression: init
        });
      }
    }

    if (this.term && this.isPunctuator(lookahead, '?')) {
      return this.enforestConditionalExpression();
    }

    return EXPR_LOOP_NO_CHANGE;
  }

  enforestPrimaryExpression() {
    let lookahead = this.peek();
    // $x:ThisExpression
    if (this.term === null && this.isKeyword(lookahead, 'this')) {
      return this.enforestThisExpression();
    }
    if (this.term === null && this.isAsyncTransform(lookahead) && this.isFnDeclTransform(this.peek(1)) && this.lineNumberEq(lookahead, this.peek(1))) {
      this.advance();
      return this.enforestFunction({
        isExpr: true,
        isAsync: true
      });
    }
    // $x:ident
    if (this.term === null && (this.isIdentifier(lookahead) || this.isKeyword(lookahead, 'let') || this.isKeyword(lookahead, 'yield'))) {
      return this.enforestIdentifierExpression();
    }
    if (this.term === null && this.isNumericLiteral(lookahead)) {
      return this.enforestNumericLiteral();
    }
    if (this.term === null && this.isStringLiteral(lookahead)) {
      return this.enforestStringLiteral();
    }
    if (this.term === null && this.isTemplate(lookahead)) {
      return this.enforestTemplateLiteral();
    }
    if (this.term === null && this.isBooleanLiteral(lookahead)) {
      return this.enforestBooleanLiteral();
    }
    if (this.term === null && this.isNullLiteral(lookahead)) {
      return this.enforestNullLiteral();
    }
    if (this.term === null && this.isRegularExpression(lookahead)) {
      return this.enforestRegularExpressionLiteral();
    }
    // $x:FunctionExpression
    if (this.term === null && this.isFnDeclTransform(lookahead)) {
      return this.enforestFunction({
        isExpr: true
      });
    }
    // { $p:prop (,) ... }
    if (this.term === null && this.isBraces(lookahead)) {
      return this.enforestObjectExpression();
    }
    // [$x:expr (,) ...]
    if (this.term === null && this.isBrackets(lookahead)) {
      return this.enforestArrayExpression();
    }
    (0, _errors.assert)(false, 'Not a primary expression');
  }

  enforestLeftHandSideExpression({ allowCall }) {
    let lookahead = this.peek();

    if (this.isCompiletimeTransform(lookahead)) {
      this.expandMacro();
      lookahead = this.peek();
    }

    if (this.isSuperTransform(lookahead)) {
      this.advance();
      this.term = new T.Super({});
    } else if (this.isNewTransform(lookahead)) {
      this.term = this.enforestNewExpression();
    } else if (this.isThisTransform(lookahead)) {
      this.term = this.enforestThisExpression();
    } else if (this.isBraces(lookahead)) {
      this.term = this.enforestPrimaryExpression();
      return this.term;
    }

    while (true) {
      lookahead = this.peek();
      if (this.isParens(lookahead)) {
        if (!allowCall) {
          // we're dealing with a new expression
          if (this.term && ((0, _terms.isIdentifierExpression)(this.term) || (0, _terms.isStaticMemberExpression)(this.term) || (0, _terms.isComputedMemberExpression)(this.term))) {
            return this.term;
          }
          this.term = this.enforestExpressionLoop();
        } else {
          this.term = this.enforestCallExpression();
        }
      } else if (this.isBrackets(lookahead)) {
        this.term = this.term ? this.enforestComputedMemberExpression() : this.enforestPrimaryExpression();
      } else if (this.isPunctuator(lookahead, '.') && (this.isIdentifier(this.peek(1)) || this.isKeyword(this.peek(1)))) {
        this.term = this.enforestStaticMemberExpression();
      } else if (this.isTemplate(lookahead)) {
        this.term = this.enforestTemplateLiteral();
      } else if (this.isIdentifier(lookahead)) {
        if (this.term) break;
        this.term = new T.IdentifierExpression({
          name: this.enforestIdentifier()
        });
      } else {
        break;
      }
    }
    return this.term;
  }

  enforestBooleanLiteral() {
    return new T.LiteralBooleanExpression({
      value: this.matchRawSyntax().val() === 'true'
    });
  }

  enforestTemplateLiteral() {
    return new T.TemplateExpression({
      tag: this.term,
      elements: this.enforestTemplateElements()
    });
  }

  enforestStringLiteral() {
    return new T.LiteralStringExpression({
      value: this.matchRawSyntax().val()
    });
  }

  enforestNumericLiteral() {
    let num = this.matchRawSyntax();
    if (num.val() === 1 / 0) {
      return new T.LiteralInfinityExpression({});
    }
    return new T.LiteralNumericExpression({
      value: num.val()
    });
  }

  enforestIdentifierExpression() {
    return new T.IdentifierExpression({
      name: this.matchRawSyntax()
    });
  }

  enforestRegularExpressionLiteral() {
    let reStx = this.matchRawSyntax();

    let lastSlash = reStx.token.value.lastIndexOf('/');
    let pattern = reStx.token.value.slice(1, lastSlash);
    let flags = reStx.token.value.slice(lastSlash + 1);
    return new T.LiteralRegExpExpression({
      pattern,
      global: flags.includes('g'),
      ignoreCase: flags.includes('i'),
      multiline: flags.includes('m'),
      sticky: flags.includes('y'),
      unicode: flags.includes('u')
    });
  }

  enforestNullLiteral() {
    this.advance();
    return new T.LiteralNullExpression({});
  }

  enforestThisExpression() {
    return new T.ThisExpression({
      stx: this.matchRawSyntax()
    });
  }

  enforestArgumentList() {
    let result = [];
    while (this.rest.size > 0) {
      let arg;
      if (this.isPunctuator(this.peek(), '...')) {
        this.advance();
        arg = new T.SpreadElement({
          expression: this.enforestExpressionLoop()
        });
      } else {
        arg = this.enforestExpressionLoop();
      }
      if (this.rest.size > 0) {
        this.matchPunctuator(',');
      }
      result.push(arg);
    }
    return (0, _immutable.List)(result);
  }

  enforestNewExpression() {
    this.matchKeyword('new');
    if (this.isPunctuator(this.peek(), '.') && this.isIdentifier(this.peek(1), 'target')) {
      this.advance();
      this.advance();
      return new T.NewTargetExpression({});
    }

    let callee = this.enforestLeftHandSideExpression({
      allowCall: false
    });
    let args;
    if (this.isParens(this.peek())) {
      args = this.matchParens();
    } else {
      args = (0, _immutable.List)();
    }
    return new T.NewExpression({
      callee,
      arguments: args
    });
  }

  enforestComputedMemberExpression() {
    let enf = new Enforester(this.matchSquares(), (0, _immutable.List)(), this.context);
    return new T.ComputedMemberExpression({
      object: this.term,
      expression: enf.enforestExpression()
    });
  }

  transformDestructuring(term) {
    switch (term.type) {
      case 'IdentifierExpression':
        return new T.AssignmentTargetIdentifier({
          name: term.name
        });

      case 'ParenthesizedExpression':
        {
          let enf = new Enforester(term.inner, (0, _immutable.List)(), this.context);
          let expr = enf.enforestExpression();
          return this.transformDestructuring(expr);
        }
      case 'DataProperty':
        return new T.AssignmentTargetPropertyProperty({
          name: term.name,
          binding: this.transformDestructuringWithDefault(term.expression)
        });
      case 'ShorthandProperty':
        return new T.AssignmentTargetPropertyIdentifier({
          binding: new T.AssignmentTargetIdentifier({
            name: term.name
          }),
          init: null
        });
      case 'ObjectExpression':
        return new T.ObjectAssignmentTarget({
          properties: term.properties.map(t => this.transformDestructuring(t))
        });
      case 'ArrayExpression':
        {
          let last = term.elements.last();
          if (last != null && last.type === 'SpreadElement') {
            return new T.ArrayAssignmentTarget({
              elements: term.elements.slice(0, -1).map(t => t && this.transformDestructuringWithDefault(t)),
              rest: this.transformDestructuringWithDefault(last.expression)
            });
          } else {
            return new T.ArrayAssignmentTarget({
              elements: term.elements.map(t => t && this.transformDestructuringWithDefault(t)),
              rest: null
            });
          }
        }
      case 'StaticPropertyName':
        return new T.AssignmentTargetIdentifier({
          name: term.value
        });
      case 'ComputedMemberExpression':
        return new T.ComputedMemberAssignmentTarget({
          object: term.object,
          expression: term.expression
        });
      case 'StaticMemberExpression':
        return new T.StaticMemberAssignmentTarget({
          object: term.object,
          property: term.property
        });
      case 'BindingPropertyIdentifier':
        return new T.AssignmentTargetPropertyIdentifier({
          binding: this.transformDestructuring(term.binding),
          init: term.init
        });
      case 'BindingIdentifier':
        return new T.AssignmentTargetIdentifier({
          name: term.name
        });
      // case 'ArrayBinding':
      // case 'BindingPropertyProperty':
      // case 'BindingWithDefault':
      // case 'ObjectBinding':
      case 'ObjectAssignmentTarget':
      case 'ArrayAssignmentTarget':
      case 'AssignmentTargetWithDefault':
      case 'AssignmentTargetIdentifier':
      case 'AssignmentTargetPropertyIdentifier':
      case 'AssignmentTargetPropertyProperty':
      case 'StaticMemberAssignmentTarget':
      case 'ComputedMemberAssignmentTarget':
        return term;
    }
    (0, _errors.assert)(false, 'not implemented yet for ' + term.type);
  }

  transformDestructuringWithDefault(term) {
    switch (term.type) {
      case 'AssignmentExpression':
        return new T.AssignmentTargetWithDefault({
          binding: this.transformDestructuring(term.binding),
          init: term.expression
        });
    }
    return this.transformDestructuring(term);
  }

  enforestCallExpression() {
    let paren = this.matchParens();
    return new T.CallExpressionE({
      callee: this.term,
      arguments: paren
    });
  }

  enforestArrowExpression({ isAsync }) {
    let enf;
    if (this.isIdentifier(this.peek())) {
      enf = new Enforester(_immutable.List.of(this.advance()), (0, _immutable.List)(), this.context);
    } else {
      let p = this.matchParens();
      enf = new Enforester(p, (0, _immutable.List)(), this.context);
    }
    let params = enf.enforestFormalParameters();
    this.matchPunctuator('=>');

    let body;
    if (this.isBraces(this.peek())) {
      body = this.matchCurlies();
      return new T.ArrowExpressionE({
        isAsync,
        params,
        body
      });
    } else {
      enf = new Enforester(this.rest, (0, _immutable.List)(), this.context);
      let originalAwait = this.context.allowAwait;
      this.context.allowAwait = isAsync;
      body = enf.enforestExpressionLoop();
      this.context.allowAwait = originalAwait;
      this.rest = enf.rest;
      return new T.ArrowExpression({
        isAsync,
        params,
        body
      });
    }
  }

  enforestYieldExpression() {
    let kwd = this.matchKeyword('yield');
    let lookahead = this.peek();

    if (this.rest.size === 0 || lookahead && !this.lineNumberEq(kwd, lookahead)) {
      return new T.YieldExpression({
        expression: null
      });
    } else {
      let isGenerator = false;
      if (this.isPunctuator(this.peek(), '*')) {
        isGenerator = true;
        this.advance();
      }
      let expr = this.enforestExpression();
      return new (isGenerator ? T.YieldGeneratorExpression : T.YieldExpression)({
        expression: expr
      });
    }
  }

  enforestSyntaxTemplate() {
    return new T.SyntaxTemplate({
      template: this.matchRawDelimiter()
    });
  }

  enforestStaticMemberExpression() {
    let object = this.term;
    this.advance();
    let property = this.matchRawSyntax();

    return new T.StaticMemberExpression({
      object: object,
      property: property
    });
  }

  enforestArrayExpression() {
    let arr = this.matchSquares();

    let elements = [];

    let enf = new Enforester(arr, (0, _immutable.List)(), this.context);

    while (enf.rest.size > 0) {
      let lookahead = enf.peek();
      let expression = null;
      if (!enf.isPunctuator(lookahead, ',')) {
        let isSpread = false;
        if (enf.isPunctuator(lookahead, '...')) {
          enf.advance();
          isSpread = true;
        }
        expression = enf.enforestExpressionLoop();
        if (expression == null) {
          // this was a macro that expanded to nothing
          continue;
        }
        if (enf.rest.size > 0 && !enf.isPunctuator(enf.peek(), ',')) {
          throw enf.createError(enf.peek(), 'unexpected token');
        }
        if (isSpread) {
          expression = new T.SpreadElement({
            expression
          });
        }
      }
      enf.consumeComma();
      elements.push(expression);
    }

    return new T.ArrayExpression({
      elements: (0, _immutable.List)(elements)
    });
  }

  enforestObjectExpression() {
    let obj = this.matchCurlies();

    let properties = (0, _immutable.List)();

    let enf = new Enforester(obj, (0, _immutable.List)(), this.context);

    let lastProp = null;
    //TODO: implement object spread operator when it lands
    while (enf.rest.size > 0) {
      let prop = enf.enforestPropertyDefinition();

      if (enf.rest.size > 0 && !enf.isPunctuator(enf.peek(), ',')) {
        throw enf.createError(enf.peek(), 'unexpected token');
      }

      enf.consumeComma();
      // TODO: bug in immutable type definitions for concat,
      // upgrade to v4 when it is released
      // https://github.com/facebook/immutable-js/pull/1153
      properties = properties.concat(prop);

      if (lastProp === prop) {
        throw enf.createError(prop, 'invalid syntax in object');
      }
      lastProp = prop;
    }

    return new T.ObjectExpression({
      properties: properties
    });
  }

  enforestPropertyDefinition() {
    let { methodOrKey, kind } = this.enforestMethodDefinition();

    switch (kind) {
      case 'method':
        return methodOrKey;
      case 'identifier':
        if (this.isAssign(this.peek())) {
          this.advance();
          let init = this.enforestExpressionLoop();
          return new T.BindingPropertyIdentifier({
            init,
            binding: this.transformDestructuring(methodOrKey)
          });
        } else if (!this.isPunctuator(this.peek(), ':')) {
          return new T.ShorthandProperty({
            name: methodOrKey.value
          });
        }
    }

    this.matchPunctuator(':');
    let expr = this.enforestExpressionLoop();

    return new T.DataProperty({
      name: methodOrKey,
      expression: expr
    });
  }

  enforestMethodDefinition() {
    let lookahead = this.peek();
    let isGenerator = false;
    let isAsync = false;
    if (this.isPunctuator(lookahead, '*')) {
      isGenerator = true;
      this.advance();
    }

    if (this.isIdentifier(lookahead, 'async') && !this.isPunctuator(this.peek(1), ':')) {
      isAsync = true;
      this.advance();
    }

    if (this.isIdentifier(lookahead, 'get') && this.isPropertyName(this.peek(1))) {
      this.advance();
      let { name } = this.enforestPropertyName();
      this.matchParens();
      let body = this.matchCurlies();
      return {
        methodOrKey: new T.Getter({
          name,
          body
        }),
        kind: 'method'
      };
    } else if (this.isIdentifier(lookahead, 'set') && this.isPropertyName(this.peek(1))) {
      this.advance();
      let { name } = this.enforestPropertyName();
      let enf = new Enforester(this.matchParens(), (0, _immutable.List)(), this.context);
      let param = enf.enforestBindingElement();
      let body = this.matchCurlies();
      return {
        methodOrKey: new T.Setter({
          name,
          param,
          body
        }),
        kind: 'method'
      };
    }
    let { name } = this.enforestPropertyName();
    if (this.isParens(this.peek())) {
      let params = this.matchParens();
      let enf = new Enforester(params, (0, _immutable.List)(), this.context);
      let formalParams = enf.enforestFormalParameters();

      let body = this.matchCurlies();
      return {
        methodOrKey: new T.Method({
          isAsync,
          isGenerator,
          name,
          params: formalParams,
          body
        }),
        kind: 'method'
      };
    }
    return {
      methodOrKey: name,
      kind: this.isIdentifier(lookahead) || this.isKeyword(lookahead) ? 'identifier' : 'property'
    };
  }

  enforestPropertyName() {
    let lookahead = this.peek();

    if (this.isStringLiteral(lookahead) || this.isNumericLiteral(lookahead)) {
      return {
        name: new T.StaticPropertyName({
          value: this.matchRawSyntax()
        }),
        binding: null
      };
    } else if (this.isBrackets(lookahead)) {
      let enf = new Enforester(this.matchSquares(), (0, _immutable.List)(), this.context);
      let expr = enf.enforestExpressionLoop();
      return {
        name: new T.ComputedPropertyName({
          expression: expr
        }),
        binding: null
      };
    }
    let name = this.matchRawSyntax();
    return {
      name: new T.StaticPropertyName({
        value: name
      }),
      binding: new T.BindingIdentifier({
        name
      })
    };
  }

  enforestFunction({
    isExpr,
    inDefault,
    isAsync
  }) {
    let name = null,
        params,
        body;
    let isGenerator = false;
    // eat the function keyword
    let fnKeyword = this.matchRawSyntax();
    let lookahead = this.peek();

    if (this.isPunctuator(lookahead, '*')) {
      isGenerator = true;
      this.advance();
      lookahead = this.peek();
    }

    if (!this.isParens(lookahead)) {
      name = this.enforestBindingIdentifier();
    } else if (inDefault) {
      name = new T.BindingIdentifier({
        name: _syntax2.default.fromIdentifier('*default*', fnKeyword)
      });
    }

    params = this.matchParens();

    body = this.matchCurlies();

    let enf = new Enforester(params, (0, _immutable.List)(), this.context);
    let formalParams = enf.enforestFormalParameters();

    return new (isExpr ? T.FunctionExpressionE : T.FunctionDeclarationE)({
      name,
      isAsync,
      isGenerator,
      params: formalParams,
      body
    });
  }

  enforestFormalParameters() {
    let items = [];
    let rest = null;
    while (this.rest.size !== 0) {
      let lookahead = this.peek();
      if (this.isPunctuator(lookahead, '...')) {
        this.matchPunctuator('...');
        rest = this.enforestBindingIdentifier();
        break;
      }
      items.push(this.enforestParam());
      this.consumeComma();
    }
    return new T.FormalParameters({
      items: (0, _immutable.List)(items),
      rest
    });
  }

  enforestParam() {
    return this.enforestBindingElement();
  }

  enforestUpdateExpression() {
    const lookahead = this.peek();
    const leftTerm = this.term;
    if (!lookahead) {
      throw this.createError(lookahead, 'assertion failure: operator is null');
    }
    let operator = this.matchRawSyntax();
    if (this.isCompiletimeTransform(lookahead)) {
      const operatorTransform = this.getFromCompiletimeEnvironment(operator);
      if (!operatorTransform || operatorTransform.value.type !== 'operator') {
        throw this.createError(lookahead, 'unexpected transform');
      }
      let result = operatorTransform.value.f.call(null, leftTerm);
      let enf = new Enforester(result, (0, _immutable.List)(), this.context);
      return enf.enforestExpressionLoop();
    }
    return new T.UpdateExpression({
      isPrefix: false,
      operator: operator.val(),
      operand: this.transformDestructuring(leftTerm)
    });
  }

  enforestUnaryExpression() {
    const lookahead = this.peek();
    if (!lookahead) {
      throw this.createError(lookahead, 'assertion failure: operator is null');
    }
    if (this.isAwaitTransform(lookahead) && !this.context.allowAwait) {
      throw this.createError(lookahead, 'await is only allowed in async functions');
    }
    let operator = this.matchRawSyntax();
    let prec, combine;
    if (this.isCompiletimeTransform(lookahead)) {
      const operatorTransform = this.getFromCompiletimeEnvironment(lookahead);
      if (!operatorTransform || operatorTransform.value.type !== 'operator') {
        throw this.createError(lookahead, 'unexpected transform');
      }
      prec = operatorTransform.value.prec;
      combine = rightTerm => {
        return this.expandOperator(lookahead, operatorTransform, [rightTerm]);
      };
    } else {
      // all builtins are 16
      prec = 16;
      combine = rightTerm => {
        if (operator.val() === '++' || operator.val() === '--') {
          return new T.UpdateExpression({
            operator: operator.val(),
            operand: this.transformDestructuring(rightTerm),
            isPrefix: true
          });
        } else {
          return new T.UnaryExpression({
            operator: operator.val(),
            operand: rightTerm
          });
        }
      };
    }

    this.opCtx.stack = this.opCtx.stack.push({
      prec: this.opCtx.prec,
      combine: this.opCtx.combine
    });
    this.opCtx.prec = prec;
    this.opCtx.combine = rightTerm => {
      return combine(rightTerm);
    };
    return EXPR_LOOP_OPERATOR;
  }

  enforestConditionalExpression() {
    // first, pop the operator stack
    let test = this.opCtx.combine(this.term);
    if (this.opCtx.stack.size > 0) {
      let { prec, combine } = this.opCtx.stack.last();
      this.opCtx.stack = this.opCtx.stack.pop();
      this.opCtx.prec = prec;
      this.opCtx.combine = combine;
    }

    this.matchPunctuator('?');
    let enf = new Enforester(this.rest, (0, _immutable.List)(), this.context);
    let consequent = enf.enforestExpressionLoop();
    enf.matchPunctuator(':');
    enf = new Enforester(enf.rest, (0, _immutable.List)(), this.context);
    let alternate = enf.enforestExpressionLoop();
    this.rest = enf.rest;
    return new T.ConditionalExpression({
      test,
      consequent,
      alternate
    });
  }

  enforestBinaryExpression() {
    let leftTerm = this.term;
    const opStx = this.peek();
    if (!opStx) {
      throw this.createError(opStx, 'assertion failure: opStx is null');
    }

    let prec, assoc, combine;
    if (this.isCompiletimeTransform(this.peek())) {
      const operatorTransform = this.getFromCompiletimeEnvironment(opStx.value);
      if (!operatorTransform || operatorTransform.value.type !== 'operator') {
        throw this.createError(opStx.value, 'unexpected transform');
      }
      prec = operatorTransform.value.prec;
      assoc = operatorTransform.value.assoc;
      combine = (left, right) => {
        return this.expandOperator(opStx, operatorTransform, [left, right]);
      };
    } else {
      prec = (0, _operators.getOperatorPrec)(opStx.value.val());
      assoc = (0, _operators.getOperatorAssoc)(opStx.value.val());
      combine = (left, right) => new T.BinaryExpression({
        left,
        right,
        operator: opStx.value.val()
      });
    }

    if ((0, _operators.operatorLt)(this.opCtx.prec, prec, assoc)) {
      this.opCtx.stack = this.opCtx.stack.push({
        prec: this.opCtx.prec,
        combine: this.opCtx.combine
      });
      this.opCtx.prec = prec;
      this.opCtx.combine = rightTerm => {
        return combine(leftTerm, rightTerm);
      };
      this.advance();
      return EXPR_LOOP_OPERATOR;
    } else {
      let term = this.opCtx.combine(leftTerm);
      // this.rest does not change
      let { prec, combine } = this.opCtx.stack.last();
      this.opCtx.stack = this.opCtx.stack.pop();
      this.opCtx.prec = prec;
      this.opCtx.combine = combine;
      return term;
    }
  }

  enforestTemplateElements() {
    let lookahead = this.matchTemplate();
    let elements = lookahead.token.items.map(it => {
      if (this.isDelimiter(it)) {
        let enf = new Enforester(it.inner.slice(1, it.inner.size - 1), (0, _immutable.List)(), this.context);
        return enf.enforest('expression');
      }
      return new T.TemplateElement({
        rawValue: it.value.token.slice.text
      });
    });
    return elements;
  }

  expandMacro() {
    let lookahead = this.peek();
    while (this.isCompiletimeTransform(lookahead)) {
      let name = this.matchRawSyntax();

      let syntaxTransform = this.getFromCompiletimeEnvironment(name);
      if (syntaxTransform == null) {
        throw this.createError(name, `The macro ${name.resolve(this.context.phase)} does not have a bound value`);
      } else if (typeof syntaxTransform.value.f !== 'function') {
        throw this.createError(name, `The macro ${name.resolve(this.context.phase)} was not bound to a callable value: ${syntaxTransform.value.f}`);
      }
      let useSiteScope = (0, _scope.freshScope)('u');
      let introducedScope = (0, _scope.freshScope)('i');
      // TODO: needs to be a list of scopes I think
      this.context.useScope = useSiteScope;

      let ctx = new _macroContext2.default(this, name, this.context, useSiteScope, introducedScope);

      let result = (0, _loadSyntax.sanitizeReplacementValues)(syntaxTransform.value.f.call(null, ctx));
      if (!_immutable.List.isList(result)) {
        throw this.createError(name, 'macro must return a list but got: ' + result);
      }
      let scopeReducer = new _scopeReducer2.default([{
        scope: introducedScope,
        phase: _syntax.ALL_PHASES,
        flip: true
      }], this.context.bindings, true);
      result = result.map(terms => {
        if (terms instanceof _syntax2.default) {
          return new T.RawSyntax({
            value: terms
            // $FlowFixMe: flow doesn't know about reduce on terms yet
          }).reduce(scopeReducer);
        } else if (!(terms instanceof T.default)) {
          throw this.createError(name, 'macro must return syntax objects or terms but got: ' + terms);
        }
        return terms.reduce(scopeReducer);
      });

      this.rest = result.concat(ctx._rest(this));
      lookahead = this.peek();
    }
  }

  expandOperator(name, operatorTransform, args) {
    let useSiteScope = (0, _scope.freshScope)('u');
    let introducedScope = (0, _scope.freshScope)('i');
    // TODO: needs to be a list of scopes I think
    this.context.useScope = useSiteScope;
    args = args.map(arg => {
      // $FlowFixMe: flow doesn't know about reduce on terms yet
      return arg.reduce(new _scopeReducer2.default([{
        scope: useSiteScope,
        phase: _syntax.ALL_PHASES,
        flip: false
      }, {
        scope: introducedScope,
        phase: _syntax.ALL_PHASES,
        flip: true
      }], this.context.bindings));
    });
    let result = (0, _loadSyntax.sanitizeReplacementValues)(operatorTransform.value.f.apply(null, args));
    let scopeReducer = new _scopeReducer2.default([{
      scope: introducedScope,
      phase: _syntax.ALL_PHASES,
      flip: true
    }], this.context.bindings, true);
    result = result.map(terms => {
      if (terms instanceof _syntax2.default) {
        return new T.RawSyntax({
          value: terms
          // $FlowFixMe: flow doesn't know about reduce on terms yet
        }).reduce(scopeReducer);
      } else if (!(terms instanceof T.default)) {
        throw this.createError(name, 'macro must return syntax objects or terms but got: ' + terms);
      }
      return terms.reduce(scopeReducer);
    });
    let enf = new Enforester(result, (0, _immutable.List)(), this.context);
    return enf.enforestExpressionLoop();
  }

  consumeSemicolon() {
    let lookahead = this.peek();

    if (lookahead && this.isPunctuator(lookahead, ';')) {
      this.advance();
    }
  }

  consumeComma() {
    let lookahead = this.peek();

    if (lookahead && this.isPunctuator(lookahead, ',')) {
      this.advance();
    }
  }

  safeCheck(obj, type, val = null) {
    if (obj instanceof T.default) {
      if (obj instanceof T.RawSyntax) {
        return obj.value && (typeof obj.value.match === 'function' ? obj.value.match(type, val) : false);
      } else if (obj instanceof T.RawDelimiter) {
        return type === 'delimiter' || obj.kind === type;
      }
    }
    return obj && (typeof obj.match === 'function' ? obj.match(type, val) : false);
  }

  isTerm(term) {
    return term && term instanceof T.default;
  }

  isEOF(obj) {
    return this.safeCheck(obj, 'eof');
  }

  isIdentifier(obj, val = null) {
    return this.safeCheck(obj, 'identifier', val);
  }

  isPropertyName(obj) {
    return this.isIdentifier(obj) || this.isKeyword(obj) || this.isNumericLiteral(obj) || this.isStringLiteral(obj) || this.isBrackets(obj);
  }

  isNumericLiteral(obj, val = null) {
    return this.safeCheck(obj, 'number', val);
  }

  isStringLiteral(obj, val = null) {
    return this.safeCheck(obj, 'string', val);
  }

  isTemplate(obj, val = null) {
    return this.safeCheck(obj, 'template', val);
  }

  isSyntaxTemplate(obj) {
    return this.safeCheck(obj, 'syntaxTemplate');
  }

  isBooleanLiteral(obj, val = null) {
    return this.safeCheck(obj, 'boolean', val);
  }

  isNullLiteral(obj, val = null) {
    return this.safeCheck(obj, 'null', val);
  }

  isRegularExpression(obj, val = null) {
    return this.safeCheck(obj, 'regularExpression', val);
  }

  isDelimiter(obj) {
    return this.safeCheck(obj, 'delimiter');
  }

  isParens(obj) {
    return this.safeCheck(obj, 'parens');
  }

  isBraces(obj) {
    return this.safeCheck(obj, 'braces');
  }

  isBrackets(obj) {
    return this.safeCheck(obj, 'brackets');
  }

  isAssign(obj, val = null) {
    return this.safeCheck(obj, 'assign', val);
  }

  isKeyword(obj, val = null) {
    return this.safeCheck(obj, 'keyword', val);
  }

  isPunctuator(obj, val = null) {
    return this.safeCheck(obj, 'punctuator', val);
  }

  isOperator(obj) {
    return (this.safeCheck(obj, 'punctuator') || this.safeCheck(obj, 'identifier') || this.safeCheck(obj, 'keyword')) && (obj instanceof T.RawSyntax && (0, _operators.isOperator)(obj.value) || obj instanceof _syntax2.default && (0, _operators.isOperator)(obj));
  }

  isCustomPrefixOperator(obj) {
    if (this.isCompiletimeTransform(obj)) {
      let t = this.getFromCompiletimeEnvironment(obj.value);
      return t && t.value.assoc === 'prefix';
    }
    return false;
  }

  isCustomPostfixOperator(obj) {
    if (this.isCompiletimeTransform(obj)) {
      let t = this.getFromCompiletimeEnvironment(obj.value);
      return t && t.value.assoc === 'postfix';
    }
    return false;
  }

  isCustomBinaryOperator(obj) {
    if (this.isCompiletimeTransform(obj)) {
      let t = this.getFromCompiletimeEnvironment(obj.value);
      return t && (t.value.assoc === 'left' || t.value.assoc === 'right');
    }
    return false;
  }

  isUpdateOperator(obj) {
    return this.safeCheck(obj, 'punctuator', '++') || this.safeCheck(obj, 'punctuator', '--');
  }

  safeResolve(obj, phase) {
    if (obj instanceof T.RawSyntax) {
      return typeof obj.value.resolve === 'function' ? Just(obj.value.resolve(phase)) : Nothing();
    } else if (obj instanceof _syntax2.default) {
      return typeof obj.resolve === 'function' ? Just(obj.resolve(phase)) : Nothing();
    }
    return Nothing();
  }

  isTransform(obj, trans) {
    return this.safeResolve(obj, this.context.phase).map(name => this.context.env.get(name) === trans || this.context.store.get(name) === trans).getOrElse(false);
  }

  isTransformInstance(obj, trans) {
    return this.safeResolve(obj, this.context.phase).map(name => this.context.env.get(name) instanceof trans || this.context.store.get(name) instanceof trans).getOrElse(false);
  }

  isFnDeclTransform(obj) {
    return this.isTransform(obj, _transforms.FunctionDeclTransform);
  }

  isVarDeclTransform(obj) {
    return this.isTransform(obj, _transforms.VariableDeclTransform);
  }

  isLetDeclTransform(obj) {
    return this.isTransform(obj, _transforms.LetDeclTransform);
  }

  isConstDeclTransform(obj) {
    return this.isTransform(obj, _transforms.ConstDeclTransform);
  }

  isSyntaxDeclTransform(obj) {
    return this.isTransform(obj, _transforms.SyntaxDeclTransform);
  }

  isSyntaxrecDeclTransform(obj) {
    return this.isTransform(obj, _transforms.SyntaxrecDeclTransform);
  }

  isReturnStmtTransform(obj) {
    return this.isTransform(obj, _transforms.ReturnStatementTransform);
  }

  isWhileTransform(obj) {
    return this.isTransform(obj, _transforms.WhileTransform);
  }

  isForTransform(obj) {
    return this.isTransform(obj, _transforms.ForTransform);
  }

  isSwitchTransform(obj) {
    return this.isTransform(obj, _transforms.SwitchTransform);
  }

  isBreakTransform(obj) {
    return this.isTransform(obj, _transforms.BreakTransform);
  }

  isContinueTransform(obj) {
    return this.isTransform(obj, _transforms.ContinueTransform);
  }

  isDoTransform(obj) {
    return this.isTransform(obj, _transforms.DoTransform);
  }

  isDebuggerTransform(obj) {
    return this.isTransform(obj, _transforms.DebuggerTransform);
  }

  isWithTransform(obj) {
    return this.isTransform(obj, _transforms.WithTransform);
  }

  isImportTransform(obj) {
    return this.isTransform(obj, _transforms.ImportTransform);
  }

  isExportTransform(obj) {
    return this.isTransform(obj, _transforms.ExportTransform);
  }

  isTryTransform(obj) {
    return this.isTransform(obj, _transforms.TryTransform);
  }

  isThrowTransform(obj) {
    return this.isTransform(obj, _transforms.ThrowTransform);
  }

  isOperatorDeclTransform(obj) {
    return this.isTransform(obj, _transforms.OperatorDeclTransform);
  }

  isIfTransform(obj) {
    return this.isTransform(obj, _transforms.IfTransform);
  }

  isNewTransform(obj) {
    return this.isTransform(obj, _transforms.NewTransform);
  }

  isSuperTransform(obj) {
    return this.isTransform(obj, _transforms.SuperTransform);
  }

  isThisTransform(obj) {
    return this.isTransform(obj, _transforms.ThisTransform);
  }

  isClassTransform(obj) {
    return this.isTransform(obj, _transforms.ClassTransform);
  }

  isYieldTransform(obj) {
    return this.isTransform(obj, _transforms.YieldTransform);
  }

  isAsyncTransform(obj) {
    return this.isTransform(obj, _transforms.AsyncTransform);
  }

  isAwaitTransform(obj) {
    return this.isTransform(obj, _transforms.AwaitTransform);
  }

  isDefaultTransform(obj) {
    return this.isTransform(obj, _transforms.DefaultTransform);
  }

  isCompiletimeTransform(obj) {
    return this.isTransformInstance(obj, _transforms.CompiletimeTransform);
  }

  isModuleNamespaceTransform(obj) {
    return this.isTransformInstance(obj, _transforms.ModuleNamespaceTransform);
  }

  isVarBindingTransform(obj) {
    return this.isTransformInstance(obj, _transforms.VarBindingTransform);
  }

  getFromCompiletimeEnvironment(term) {
    if (this.context.env.has(term.resolve(this.context.phase))) {
      return this.context.env.get(term.resolve(this.context.phase));
    }
    return this.context.store.get(term.resolve(this.context.phase));
  }

  lineNumberEq(a, b) {
    if (!(a && b)) {
      return false;
    }
    return getLineNumber(a) === getLineNumber(b);
  }

  matchRawDelimiter() {
    let lookahead = this.advance();
    if (lookahead instanceof T.RawDelimiter) {
      // $FlowFixMe: terms are currently typed with arrays not lists
      return lookahead.inner;
    }
    throw this.createError(lookahead, 'expecting a RawDelimiter');
  }

  matchRawSyntax() {
    let lookahead = this.advance();
    if (lookahead instanceof T.RawSyntax) {
      return lookahead.value;
    }
    throw this.createError(lookahead, 'expecting a RawSyntax');
  }

  matchIdentifier(val) {
    let lookahead = this.peek();
    if (this.isIdentifier(lookahead, val)) {
      return this.matchRawSyntax();
    }
    throw this.createError(lookahead, 'expecting an identifier');
  }

  matchKeyword(val) {
    let lookahead = this.peek();
    if (this.isKeyword(lookahead, val)) {
      return this.matchRawSyntax();
    }
    throw this.createError(lookahead, 'expecting ' + val);
  }

  matchLiteral() {
    let lookahead = this.peek();
    if (this.isNumericLiteral(lookahead) || this.isStringLiteral(lookahead) || this.isBooleanLiteral(lookahead) || this.isNullLiteral(lookahead) || this.isTemplate(lookahead) || this.isRegularExpression(lookahead)) {
      return this.matchRawSyntax();
    }
    throw this.createError(lookahead, 'expecting a literal');
  }

  matchStringLiteral() {
    let lookahead = this.peek();
    if (this.isStringLiteral(lookahead)) {
      return this.matchRawSyntax();
    }
    throw this.createError(lookahead, 'expecting a string literal');
  }

  matchTemplate() {
    let lookahead = this.peek();
    if (this.isTemplate(lookahead)) {
      return this.matchRawSyntax();
    }
    throw this.createError(lookahead, 'expecting a template literal');
  }

  matchParens() {
    let lookahead = this.peek();
    if (this.isParens(lookahead)) {
      let inner = this.matchRawDelimiter();
      return inner.slice(1, inner.size - 1);
    }
    throw this.createError(lookahead, 'expecting parens');
  }

  matchCurlies() {
    let lookahead = this.peek();
    if (this.isBraces(lookahead)) {
      let inner = this.matchRawDelimiter();
      return inner.slice(1, inner.size - 1);
    }
    throw this.createError(lookahead, 'expecting curly braces');
  }

  matchSquares() {
    let lookahead = this.peek();
    if (this.isBrackets(lookahead)) {
      let inner = this.matchRawDelimiter();
      return inner.slice(1, inner.size - 1);
    }
    throw this.createError(lookahead, 'expecting square braces');
  }

  matchUnaryOperator() {
    let lookahead = this.matchRawSyntax();
    if ((0, _operators.isUnaryOperator)(lookahead)) {
      return lookahead;
    }
    throw this.createError(lookahead, 'expecting a unary operator');
  }

  matchPunctuator(val) {
    let lookahead = this.matchRawSyntax();
    if (this.isPunctuator(lookahead)) {
      if (typeof val !== 'undefined') {
        if (lookahead.val() === val) {
          return lookahead;
        } else {
          throw this.createError(lookahead, 'expecting a ' + val + ' punctuator');
        }
      }
      return lookahead;
    }
    throw this.createError(lookahead, 'expecting a punctuator');
  }

  createError(stx, message) {
    let ctx = '';
    let offending = stx;
    if (this.rest.size > 0) {
      ctx = this.rest.slice(0, 20).map(term => {
        if (term instanceof T.RawDelimiter) {
          return term.inner;
        }
        return _immutable.List.of(term);
      }).flatten().map(s => {
        let sval = s instanceof T.RawSyntax ? s.value.val() : s.toString();
        if (s === offending) {
          return '__' + sval + '__';
        }
        return sval;
      }).join(' ');
    } else {
      ctx = offending == null ? '' : offending.toString();
    }
    return new Error(message + '\n' + ctx);
  }
}
exports.Enforester = Enforester;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9lbmZvcmVzdGVyLmpzIl0sIm5hbWVzIjpbIlQiLCJKdXN0IiwiTm90aGluZyIsIkVYUFJfTE9PUF9PUEVSQVRPUiIsIkVYUFJfTE9PUF9OT19DSEFOR0UiLCJFWFBSX0xPT1BfRVhQQU5TSU9OIiwiZ2V0TGluZU51bWJlciIsIngiLCJzdHgiLCJSYXdTeW50YXgiLCJ2YWx1ZSIsIlJhd0RlbGltaXRlciIsImlubmVyIiwiZmlyc3QiLCJFcnJvciIsImxpbmVOdW1iZXIiLCJFbmZvcmVzdGVyIiwiY29uc3RydWN0b3IiLCJzdHhsIiwicHJldiIsImNvbnRleHQiLCJkb25lIiwiaXNMaXN0IiwidGVybSIsInJlc3QiLCJwZWVrIiwibiIsImdldCIsImFkdmFuY2UiLCJyZXQiLCJlbmZvcmVzdCIsInR5cGUiLCJzaXplIiwicmVzdWx0IiwiZW5mb3Jlc3RFeHByZXNzaW9uTG9vcCIsImVuZm9yZXN0TW9kdWxlIiwiZW5mb3Jlc3RCb2R5IiwiZW5mb3Jlc3RNb2R1bGVJdGVtIiwibG9va2FoZWFkIiwiaXNJbXBvcnRUcmFuc2Zvcm0iLCJlbmZvcmVzdEltcG9ydERlY2xhcmF0aW9uIiwiaXNFeHBvcnRUcmFuc2Zvcm0iLCJlbmZvcmVzdEV4cG9ydERlY2xhcmF0aW9uIiwiZW5mb3Jlc3RTdGF0ZW1lbnQiLCJpc0NvbXBpbGV0aW1lVHJhbnNmb3JtIiwiZXhwYW5kTWFjcm8iLCJpc1B1bmN0dWF0b3IiLCJFeHBvcnRBbGxGcm9tIiwibW9kdWxlU3BlY2lmaWVyIiwiZW5mb3Jlc3RGcm9tQ2xhdXNlIiwiaXNCcmFjZXMiLCJuYW1lZEV4cG9ydHMiLCJlbmZvcmVzdEV4cG9ydENsYXVzZSIsImlzSWRlbnRpZmllciIsIkV4cG9ydEZyb20iLCJtYXAiLCJzIiwiRXhwb3J0RnJvbVNwZWNpZmllciIsIkV4cG9ydExvY2FscyIsIkV4cG9ydExvY2FsU3BlY2lmaWVyIiwibmFtZSIsIklkZW50aWZpZXJFeHByZXNzaW9uIiwiZXhwb3J0ZWROYW1lIiwiaXNDbGFzc1RyYW5zZm9ybSIsIkV4cG9ydCIsImRlY2xhcmF0aW9uIiwiZW5mb3Jlc3RDbGFzcyIsImlzRXhwciIsImlzRm5EZWNsVHJhbnNmb3JtIiwiZW5mb3Jlc3RGdW5jdGlvbiIsImlzQXN5bmNUcmFuc2Zvcm0iLCJsaW5lTnVtYmVyRXEiLCJpc0FzeW5jIiwiaXNEZWZhdWx0VHJhbnNmb3JtIiwiRXhwb3J0RGVmYXVsdCIsImJvZHkiLCJpbkRlZmF1bHQiLCJjb25zdW1lU2VtaWNvbG9uIiwiaXNWYXJEZWNsVHJhbnNmb3JtIiwiaXNMZXREZWNsVHJhbnNmb3JtIiwiaXNDb25zdERlY2xUcmFuc2Zvcm0iLCJpc1N5bnRheHJlY0RlY2xUcmFuc2Zvcm0iLCJpc1N5bnRheERlY2xUcmFuc2Zvcm0iLCJpc09wZXJhdG9yRGVjbFRyYW5zZm9ybSIsImVuZm9yZXN0VmFyaWFibGVEZWNsYXJhdGlvbiIsImNyZWF0ZUVycm9yIiwiZW5mIiwibWF0Y2hDdXJsaWVzIiwicHVzaCIsImVuZm9yZXN0RXhwb3J0U3BlY2lmaWVyIiwiY29uc3VtZUNvbW1hIiwiZW5mb3Jlc3RJZGVudGlmaWVyIiwiZGVmYXVsdEJpbmRpbmciLCJuYW1lZEltcG9ydHMiLCJmb3JTeW50YXgiLCJpc1N0cmluZ0xpdGVyYWwiLCJJbXBvcnQiLCJpc0tleXdvcmQiLCJlbmZvcmVzdEJpbmRpbmdJZGVudGlmaWVyIiwiaW1wb3J0cyIsImVuZm9yZXN0TmFtZWRJbXBvcnRzIiwiZnJvbUNsYXVzZSIsIm5hbWVzcGFjZUJpbmRpbmciLCJlbmZvcmVzdE5hbWVzcGFjZUJpbmRpbmciLCJJbXBvcnROYW1lc3BhY2UiLCJtYXRjaFB1bmN0dWF0b3IiLCJtYXRjaElkZW50aWZpZXIiLCJlbmZvcmVzdEltcG9ydFNwZWNpZmllcnMiLCJtYXRjaFJhd1N5bnRheCIsIkltcG9ydFNwZWNpZmllciIsImJpbmRpbmciLCJCaW5kaW5nSWRlbnRpZmllciIsIm1hdGNoU3RyaW5nTGl0ZXJhbCIsImVuZm9yZXN0U3RhdGVtZW50TGlzdEl0ZW0iLCJpc1Rlcm0iLCJTdGF0ZW1lbnQiLCJlbmZvcmVzdEJsb2NrU3RhdGVtZW50IiwiaXNXaGlsZVRyYW5zZm9ybSIsImVuZm9yZXN0V2hpbGVTdGF0ZW1lbnQiLCJpc0lmVHJhbnNmb3JtIiwiZW5mb3Jlc3RJZlN0YXRlbWVudCIsImlzRm9yVHJhbnNmb3JtIiwiZW5mb3Jlc3RGb3JTdGF0ZW1lbnQiLCJpc1N3aXRjaFRyYW5zZm9ybSIsImVuZm9yZXN0U3dpdGNoU3RhdGVtZW50IiwiaXNCcmVha1RyYW5zZm9ybSIsImVuZm9yZXN0QnJlYWtTdGF0ZW1lbnQiLCJpc0NvbnRpbnVlVHJhbnNmb3JtIiwiZW5mb3Jlc3RDb250aW51ZVN0YXRlbWVudCIsImlzRG9UcmFuc2Zvcm0iLCJlbmZvcmVzdERvU3RhdGVtZW50IiwiaXNEZWJ1Z2dlclRyYW5zZm9ybSIsImVuZm9yZXN0RGVidWdnZXJTdGF0ZW1lbnQiLCJpc1dpdGhUcmFuc2Zvcm0iLCJlbmZvcmVzdFdpdGhTdGF0ZW1lbnQiLCJpc1RyeVRyYW5zZm9ybSIsImVuZm9yZXN0VHJ5U3RhdGVtZW50IiwiaXNUaHJvd1RyYW5zZm9ybSIsImVuZm9yZXN0VGhyb3dTdGF0ZW1lbnQiLCJlbmZvcmVzdExhYmVsZWRTdGF0ZW1lbnQiLCJzdG10IiwiVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudCIsImlzUmV0dXJuU3RtdFRyYW5zZm9ybSIsImVuZm9yZXN0UmV0dXJuU3RhdGVtZW50IiwiRW1wdHlTdGF0ZW1lbnQiLCJlbmZvcmVzdEV4cHJlc3Npb25TdGF0ZW1lbnQiLCJsYWJlbCIsIkxhYmVsZWRTdGF0ZW1lbnQiLCJtYXRjaEtleXdvcmQiLCJCcmVha1N0YXRlbWVudCIsImVuZm9yZXN0QmxvY2siLCJjYXRjaENsYXVzZSIsImVuZm9yZXN0Q2F0Y2hDbGF1c2UiLCJmaW5hbGl6ZXIiLCJUcnlGaW5hbGx5U3RhdGVtZW50IiwiVHJ5Q2F0Y2hTdGF0ZW1lbnQiLCJiaW5kaW5nUGFyZW5zIiwibWF0Y2hQYXJlbnMiLCJlbmZvcmVzdEJpbmRpbmdUYXJnZXQiLCJDYXRjaENsYXVzZSIsImV4cHJlc3Npb24iLCJlbmZvcmVzdEV4cHJlc3Npb24iLCJUaHJvd1N0YXRlbWVudCIsIm9ialBhcmVucyIsIm9iamVjdCIsIldpdGhTdGF0ZW1lbnQiLCJEZWJ1Z2dlclN0YXRlbWVudCIsInRlc3RCb2R5IiwidGVzdCIsIkRvV2hpbGVTdGF0ZW1lbnQiLCJrd2QiLCJDb250aW51ZVN0YXRlbWVudCIsImNvbmQiLCJkaXNjcmltaW5hbnQiLCJTd2l0Y2hTdGF0ZW1lbnQiLCJjYXNlcyIsImVuZm9yZXN0U3dpdGNoQ2FzZXMiLCJkZWZhdWx0Q2FzZSIsImVuZm9yZXN0U3dpdGNoRGVmYXVsdCIsInBvc3REZWZhdWx0Q2FzZXMiLCJTd2l0Y2hTdGF0ZW1lbnRXaXRoRGVmYXVsdCIsInByZURlZmF1bHRDYXNlcyIsImVuZm9yZXN0U3dpdGNoQ2FzZSIsIlN3aXRjaENhc2UiLCJjb25zZXF1ZW50IiwiZW5mb3Jlc3RTd2l0Y2hDYXNlQm9keSIsImVuZm9yZXN0U3RhdGVtZW50TGlzdEluU3dpdGNoQ2FzZUJvZHkiLCJTd2l0Y2hEZWZhdWx0IiwiaW5pdCIsInJpZ2h0IiwibGVmdCIsInVwZGF0ZSIsImNuc3QiLCJGb3JTdGF0ZW1lbnQiLCJGb3JJblN0YXRlbWVudCIsIkZvck9mU3RhdGVtZW50Iiwia2luZCIsInRyYW5zZm9ybURlc3RydWN0dXJpbmciLCJhbHRlcm5hdGUiLCJJZlN0YXRlbWVudCIsIldoaWxlU3RhdGVtZW50IiwiQmxvY2tTdGF0ZW1lbnQiLCJibG9jayIsIkJsb2NrIiwic3RhdGVtZW50cyIsImt3Iiwic3VwciIsImZyb21JZGVudGlmaWVyIiwiZWxlbWVudHMiLCJpc1N0YXRpYyIsIm1ldGhvZE9yS2V5IiwiZW5mb3Jlc3RNZXRob2REZWZpbml0aW9uIiwiU3RhdGljUHJvcGVydHlOYW1lIiwidmFsIiwiQ2xhc3NFbGVtZW50IiwibWV0aG9kIiwiQ2xhc3NFeHByZXNzaW9uIiwiQ2xhc3NEZWNsYXJhdGlvbiIsInN1cGVyIiwiYWxsb3dQdW5jdHVhdG9yIiwiaXNCcmFja2V0cyIsImVuZm9yZXN0QXJyYXlCaW5kaW5nIiwiZW5mb3Jlc3RPYmplY3RCaW5kaW5nIiwicHJvcGVydGllcyIsImVuZm9yZXN0QmluZGluZ1Byb3BlcnR5IiwiT2JqZWN0QmluZGluZyIsImVuZm9yZXN0UHJvcGVydHlOYW1lIiwiaXNBc3NpZ24iLCJleHByIiwiQmluZGluZ1Byb3BlcnR5UHJvcGVydHkiLCJCaW5kaW5nV2l0aERlZmF1bHQiLCJlbmZvcmVzdEJpbmRpbmdFbGVtZW50IiwiYnJhY2tldCIsIm1hdGNoU3F1YXJlcyIsImVsIiwiQXJyYXlCaW5kaW5nIiwiZW5mb3Jlc3RQdW5jdHVhdG9yIiwiUmV0dXJuU3RhdGVtZW50IiwiZGVjbHMiLCJlbmZvcmVzdFZhcmlhYmxlRGVjbGFyYXRvciIsImlzU3ludGF4IiwiaXNPcGVyYXRvciIsImNvbmNhdCIsIlZhcmlhYmxlRGVjbGFyYXRpb24iLCJkZWNsYXJhdG9ycyIsImlkIiwiQXNzb2NWYWx1ZXMiLCJhc3NvYyIsInByZWMiLCJpbmRleE9mIiwiam9pbiIsIm1hdGNoTGl0ZXJhbCIsIk9wZXJhdG9yRGVjbGFyYXRvciIsIlZhcmlhYmxlRGVjbGFyYXRvciIsInN0YXJ0IiwiRXhwcmVzc2lvblN0YXRlbWVudCIsIm9wZXJhdG9yIiwiQmluYXJ5RXhwcmVzc2lvbiIsIm9wQ3R4IiwiY29tYmluZSIsInN0YWNrIiwiZW5mb3Jlc3RBc3NpZ25tZW50RXhwcmVzc2lvbiIsImxhc3QiLCJwb3AiLCJpc01vZHVsZU5hbWVzcGFjZVRyYW5zZm9ybSIsIm5hbWVzcGFjZSIsImdldEZyb21Db21waWxldGltZUVudmlyb25tZW50IiwibW9kIiwiZXhwb3J0ZWROYW1lcyIsImZpbmQiLCJleE5hbWUiLCJ1bnNoaWZ0IiwiRXhwcmVzc2lvbiIsImlzWWllbGRUcmFuc2Zvcm0iLCJlbmZvcmVzdFlpZWxkRXhwcmVzc2lvbiIsImlzUGFyZW5zIiwiZW5mb3Jlc3RBcnJvd0V4cHJlc3Npb24iLCJpc1N5bnRheFRlbXBsYXRlIiwiZW5mb3Jlc3RTeW50YXhUZW1wbGF0ZSIsIlBhcmVudGhlc2l6ZWRFeHByZXNzaW9uIiwiaXNOdW1lcmljTGl0ZXJhbCIsImlzVGVtcGxhdGUiLCJpc0Jvb2xlYW5MaXRlcmFsIiwiaXNOdWxsTGl0ZXJhbCIsImlzUmVndWxhckV4cHJlc3Npb24iLCJlbmZvcmVzdFByaW1hcnlFeHByZXNzaW9uIiwiaXNDdXN0b21QcmVmaXhPcGVyYXRvciIsImVuZm9yZXN0VW5hcnlFeHByZXNzaW9uIiwiaXNWYXJCaW5kaW5nVHJhbnNmb3JtIiwibG9va3N0eCIsIm9mIiwiaXNOZXdUcmFuc2Zvcm0iLCJpc1N1cGVyVHJhbnNmb3JtIiwiZW5mb3Jlc3RMZWZ0SGFuZFNpZGVFeHByZXNzaW9uIiwiYWxsb3dDYWxsIiwiaXNDdXN0b21CaW5hcnlPcGVyYXRvciIsImVuZm9yZXN0QmluYXJ5RXhwcmVzc2lvbiIsImlzVXBkYXRlT3BlcmF0b3IiLCJpc0N1c3RvbVBvc3RmaXhPcGVyYXRvciIsImVuZm9yZXN0VXBkYXRlRXhwcmVzc2lvbiIsImVuZm9yZXN0VGVtcGxhdGVMaXRlcmFsIiwib3AiLCJBc3NpZ25tZW50RXhwcmVzc2lvbiIsIkNvbXBvdW5kQXNzaWdubWVudEV4cHJlc3Npb24iLCJlbmZvcmVzdENvbmRpdGlvbmFsRXhwcmVzc2lvbiIsImVuZm9yZXN0VGhpc0V4cHJlc3Npb24iLCJlbmZvcmVzdElkZW50aWZpZXJFeHByZXNzaW9uIiwiZW5mb3Jlc3ROdW1lcmljTGl0ZXJhbCIsImVuZm9yZXN0U3RyaW5nTGl0ZXJhbCIsImVuZm9yZXN0Qm9vbGVhbkxpdGVyYWwiLCJlbmZvcmVzdE51bGxMaXRlcmFsIiwiZW5mb3Jlc3RSZWd1bGFyRXhwcmVzc2lvbkxpdGVyYWwiLCJlbmZvcmVzdE9iamVjdEV4cHJlc3Npb24iLCJlbmZvcmVzdEFycmF5RXhwcmVzc2lvbiIsIlN1cGVyIiwiZW5mb3Jlc3ROZXdFeHByZXNzaW9uIiwiaXNUaGlzVHJhbnNmb3JtIiwiZW5mb3Jlc3RDYWxsRXhwcmVzc2lvbiIsImVuZm9yZXN0Q29tcHV0ZWRNZW1iZXJFeHByZXNzaW9uIiwiZW5mb3Jlc3RTdGF0aWNNZW1iZXJFeHByZXNzaW9uIiwiTGl0ZXJhbEJvb2xlYW5FeHByZXNzaW9uIiwiVGVtcGxhdGVFeHByZXNzaW9uIiwidGFnIiwiZW5mb3Jlc3RUZW1wbGF0ZUVsZW1lbnRzIiwiTGl0ZXJhbFN0cmluZ0V4cHJlc3Npb24iLCJudW0iLCJMaXRlcmFsSW5maW5pdHlFeHByZXNzaW9uIiwiTGl0ZXJhbE51bWVyaWNFeHByZXNzaW9uIiwicmVTdHgiLCJsYXN0U2xhc2giLCJ0b2tlbiIsImxhc3RJbmRleE9mIiwicGF0dGVybiIsInNsaWNlIiwiZmxhZ3MiLCJMaXRlcmFsUmVnRXhwRXhwcmVzc2lvbiIsImdsb2JhbCIsImluY2x1ZGVzIiwiaWdub3JlQ2FzZSIsIm11bHRpbGluZSIsInN0aWNreSIsInVuaWNvZGUiLCJMaXRlcmFsTnVsbEV4cHJlc3Npb24iLCJUaGlzRXhwcmVzc2lvbiIsImVuZm9yZXN0QXJndW1lbnRMaXN0IiwiYXJnIiwiU3ByZWFkRWxlbWVudCIsIk5ld1RhcmdldEV4cHJlc3Npb24iLCJjYWxsZWUiLCJhcmdzIiwiTmV3RXhwcmVzc2lvbiIsImFyZ3VtZW50cyIsIkNvbXB1dGVkTWVtYmVyRXhwcmVzc2lvbiIsIkFzc2lnbm1lbnRUYXJnZXRJZGVudGlmaWVyIiwiQXNzaWdubWVudFRhcmdldFByb3BlcnR5UHJvcGVydHkiLCJ0cmFuc2Zvcm1EZXN0cnVjdHVyaW5nV2l0aERlZmF1bHQiLCJBc3NpZ25tZW50VGFyZ2V0UHJvcGVydHlJZGVudGlmaWVyIiwiT2JqZWN0QXNzaWdubWVudFRhcmdldCIsInQiLCJBcnJheUFzc2lnbm1lbnRUYXJnZXQiLCJDb21wdXRlZE1lbWJlckFzc2lnbm1lbnRUYXJnZXQiLCJTdGF0aWNNZW1iZXJBc3NpZ25tZW50VGFyZ2V0IiwicHJvcGVydHkiLCJBc3NpZ25tZW50VGFyZ2V0V2l0aERlZmF1bHQiLCJwYXJlbiIsIkNhbGxFeHByZXNzaW9uRSIsInAiLCJwYXJhbXMiLCJlbmZvcmVzdEZvcm1hbFBhcmFtZXRlcnMiLCJBcnJvd0V4cHJlc3Npb25FIiwib3JpZ2luYWxBd2FpdCIsImFsbG93QXdhaXQiLCJBcnJvd0V4cHJlc3Npb24iLCJZaWVsZEV4cHJlc3Npb24iLCJpc0dlbmVyYXRvciIsIllpZWxkR2VuZXJhdG9yRXhwcmVzc2lvbiIsIlN5bnRheFRlbXBsYXRlIiwidGVtcGxhdGUiLCJtYXRjaFJhd0RlbGltaXRlciIsIlN0YXRpY01lbWJlckV4cHJlc3Npb24iLCJhcnIiLCJpc1NwcmVhZCIsIkFycmF5RXhwcmVzc2lvbiIsIm9iaiIsImxhc3RQcm9wIiwicHJvcCIsImVuZm9yZXN0UHJvcGVydHlEZWZpbml0aW9uIiwiT2JqZWN0RXhwcmVzc2lvbiIsIkJpbmRpbmdQcm9wZXJ0eUlkZW50aWZpZXIiLCJTaG9ydGhhbmRQcm9wZXJ0eSIsIkRhdGFQcm9wZXJ0eSIsImlzUHJvcGVydHlOYW1lIiwiR2V0dGVyIiwicGFyYW0iLCJTZXR0ZXIiLCJmb3JtYWxQYXJhbXMiLCJNZXRob2QiLCJDb21wdXRlZFByb3BlcnR5TmFtZSIsImZuS2V5d29yZCIsIkZ1bmN0aW9uRXhwcmVzc2lvbkUiLCJGdW5jdGlvbkRlY2xhcmF0aW9uRSIsIml0ZW1zIiwiZW5mb3Jlc3RQYXJhbSIsIkZvcm1hbFBhcmFtZXRlcnMiLCJsZWZ0VGVybSIsIm9wZXJhdG9yVHJhbnNmb3JtIiwiZiIsImNhbGwiLCJVcGRhdGVFeHByZXNzaW9uIiwiaXNQcmVmaXgiLCJvcGVyYW5kIiwiaXNBd2FpdFRyYW5zZm9ybSIsInJpZ2h0VGVybSIsImV4cGFuZE9wZXJhdG9yIiwiVW5hcnlFeHByZXNzaW9uIiwiQ29uZGl0aW9uYWxFeHByZXNzaW9uIiwib3BTdHgiLCJtYXRjaFRlbXBsYXRlIiwiaXQiLCJpc0RlbGltaXRlciIsIlRlbXBsYXRlRWxlbWVudCIsInJhd1ZhbHVlIiwidGV4dCIsInN5bnRheFRyYW5zZm9ybSIsInJlc29sdmUiLCJwaGFzZSIsInVzZVNpdGVTY29wZSIsImludHJvZHVjZWRTY29wZSIsInVzZVNjb3BlIiwiY3R4Iiwic2NvcGVSZWR1Y2VyIiwic2NvcGUiLCJmbGlwIiwiYmluZGluZ3MiLCJ0ZXJtcyIsInJlZHVjZSIsIl9yZXN0IiwiYXBwbHkiLCJzYWZlQ2hlY2siLCJtYXRjaCIsImlzRU9GIiwic2FmZVJlc29sdmUiLCJpc1RyYW5zZm9ybSIsInRyYW5zIiwiZW52Iiwic3RvcmUiLCJnZXRPckVsc2UiLCJpc1RyYW5zZm9ybUluc3RhbmNlIiwiaGFzIiwiYSIsImIiLCJtYXRjaFVuYXJ5T3BlcmF0b3IiLCJtZXNzYWdlIiwib2ZmZW5kaW5nIiwiZmxhdHRlbiIsInN2YWwiLCJ0b1N0cmluZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUNBOztBQUtBOztJQUFrQkEsQzs7QUFDbEI7O0FBQ0E7Ozs7QUFJQTs7QUFrQ0E7O0FBQ0E7O0FBQ0E7O0FBT0E7Ozs7QUFHQTs7QUFDQTs7QUFFQTs7Ozs7Ozs7QUFwREEsTUFBTUMsT0FBTyxvQkFBTUEsSUFBbkI7QUFDQSxNQUFNQyxVQUFVLG9CQUFNQSxPQUF0Qjs7QUFxREEsTUFBTUMscUJBQXFCLEVBQTNCO0FBQ0EsTUFBTUMsc0JBQXNCLEVBQTVCO0FBQ0EsTUFBTUMsc0JBQXNCLEVBQTVCOztBQUVBLFNBQVNDLGFBQVQsQ0FBdUJDLENBQXZCLEVBQStCO0FBQzdCLE1BQUlDLEdBQUo7QUFDQSxNQUFJRCw2QkFBSixFQUF5QjtBQUN2QkMsVUFBTUQsQ0FBTjtBQUNELEdBRkQsTUFFTyxJQUFJQSxhQUFhUCxFQUFFUyxTQUFuQixFQUE4QjtBQUNuQ0QsVUFBTUQsRUFBRUcsS0FBUjtBQUNELEdBRk0sTUFFQSxJQUFJSCxhQUFhUCxFQUFFVyxZQUFuQixFQUFpQztBQUN0QyxXQUFPTCxjQUFjQyxFQUFFSyxLQUFGLENBQVFDLEtBQVIsRUFBZCxDQUFQO0FBQ0QsR0FGTSxNQUVBO0FBQ0wsVUFBTSxJQUFJQyxLQUFKLENBQVcsdUJBQXNCUCxDQUFFLEVBQW5DLENBQU47QUFDRDtBQUNELFNBQU9DLElBQUlPLFVBQUosRUFBUDtBQUNEOztBQUVNLE1B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QSxRQUFJLEtBQUtnQixJQUFMLENBQVVRLElBQVYsR0FBaUIsQ0FBckIsRUFBd0I7QUFDdEI2WSxZQUFNLEtBQUtyWixJQUFMLENBQ0hxVCxLQURHLENBQ0csQ0FESCxFQUNNLEVBRE4sRUFFSHRSLEdBRkcsQ0FFQ2hDLFFBQVE7QUFDWCxZQUFJQSxnQkFBZ0J2QixFQUFFVyxZQUF0QixFQUFvQztBQUNsQyxpQkFBT1ksS0FBS1gsS0FBWjtBQUNEO0FBQ0QsZUFBTyxnQkFBS3NSLEVBQUwsQ0FBUTNRLElBQVIsQ0FBUDtBQUNELE9BUEcsRUFRSCthLE9BUkcsR0FTSC9ZLEdBVEcsQ0FTQ0MsS0FBSztBQUNSLFlBQUkrWSxPQUFPL1ksYUFBYXhELEVBQUVTLFNBQWYsR0FBMkIrQyxFQUFFOUMsS0FBRixDQUFRMk0sR0FBUixFQUEzQixHQUEyQzdKLEVBQUVnWixRQUFGLEVBQXREO0FBQ0EsWUFBSWhaLE1BQU02WSxTQUFWLEVBQXFCO0FBQ25CLGlCQUFPLE9BQU9FLElBQVAsR0FBYyxJQUFyQjtBQUNEO0FBQ0QsZUFBT0EsSUFBUDtBQUNELE9BZkcsRUFnQkg3TSxJQWhCRyxDQWdCRSxHQWhCRixDQUFOO0FBaUJELEtBbEJELE1Ba0JPO0FBQ0xtTCxZQUFNd0IsYUFBYSxJQUFiLEdBQW9CLEVBQXBCLEdBQXlCQSxVQUFVRyxRQUFWLEVBQS9CO0FBQ0Q7QUFDRCxXQUFPLElBQUkxYixLQUFKLENBQVVzYixVQUFVLElBQVYsR0FBaUJ2QixHQUEzQixDQUFQO0FBQ0Q7QUFyNUZxQjtRQUFYN1osVSxHQUFBQSxVIiwiZmlsZSI6ImVuZm9yZXN0ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBAZmxvd1xuaW1wb3J0IHtcbiAgaXNJZGVudGlmaWVyRXhwcmVzc2lvbixcbiAgaXNTdGF0aWNNZW1iZXJFeHByZXNzaW9uLFxuICBpc0NvbXB1dGVkTWVtYmVyRXhwcmVzc2lvbixcbn0gZnJvbSAnLi90ZXJtcyc7XG5pbXBvcnQgVGVybSwgKiBhcyBUIGZyb20gJ3N3ZWV0LXNwZWMnO1xuaW1wb3J0IHsgTWF5YmUgfSBmcm9tICdyYW1kYS1mYW50YXN5JztcbmltcG9ydCBTY29wZVJlZHVjZXIgZnJvbSAnLi9zY29wZS1yZWR1Y2VyJztcbmNvbnN0IEp1c3QgPSBNYXliZS5KdXN0O1xuY29uc3QgTm90aGluZyA9IE1heWJlLk5vdGhpbmc7XG5cbmltcG9ydCB7XG4gIEZ1bmN0aW9uRGVjbFRyYW5zZm9ybSxcbiAgVmFyaWFibGVEZWNsVHJhbnNmb3JtLFxuICBOZXdUcmFuc2Zvcm0sXG4gIExldERlY2xUcmFuc2Zvcm0sXG4gIENvbnN0RGVjbFRyYW5zZm9ybSxcbiAgU3ludGF4RGVjbFRyYW5zZm9ybSxcbiAgU3ludGF4cmVjRGVjbFRyYW5zZm9ybSxcbiAgT3BlcmF0b3JEZWNsVHJhbnNmb3JtLFxuICBSZXR1cm5TdGF0ZW1lbnRUcmFuc2Zvcm0sXG4gIFdoaWxlVHJhbnNmb3JtLFxuICBJZlRyYW5zZm9ybSxcbiAgRm9yVHJhbnNmb3JtLFxuICBTd2l0Y2hUcmFuc2Zvcm0sXG4gIEJyZWFrVHJhbnNmb3JtLFxuICBDb250aW51ZVRyYW5zZm9ybSxcbiAgRG9UcmFuc2Zvcm0sXG4gIERlYnVnZ2VyVHJhbnNmb3JtLFxuICBZaWVsZFRyYW5zZm9ybSxcbiAgV2l0aFRyYW5zZm9ybSxcbiAgSW1wb3J0VHJhbnNmb3JtLFxuICBFeHBvcnRUcmFuc2Zvcm0sXG4gIFN1cGVyVHJhbnNmb3JtLFxuICBUaGlzVHJhbnNmb3JtLFxuICBDbGFzc1RyYW5zZm9ybSxcbiAgRGVmYXVsdFRyYW5zZm9ybSxcbiAgVHJ5VHJhbnNmb3JtLFxuICBUaHJvd1RyYW5zZm9ybSxcbiAgQ29tcGlsZXRpbWVUcmFuc2Zvcm0sXG4gIFZhckJpbmRpbmdUcmFuc2Zvcm0sXG4gIE1vZHVsZU5hbWVzcGFjZVRyYW5zZm9ybSxcbiAgQXN5bmNUcmFuc2Zvcm0sXG4gIEF3YWl0VHJhbnNmb3JtLFxufSBmcm9tICcuL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgTGlzdCB9IGZyb20gJ2ltbXV0YWJsZSc7XG5pbXBvcnQgeyBleHBlY3QsIGFzc2VydCB9IGZyb20gJy4vZXJyb3JzJztcbmltcG9ydCB7XG4gIGlzT3BlcmF0b3IsXG4gIGlzVW5hcnlPcGVyYXRvcixcbiAgZ2V0T3BlcmF0b3JBc3NvYyxcbiAgZ2V0T3BlcmF0b3JQcmVjLFxuICBvcGVyYXRvckx0LFxufSBmcm9tICcuL29wZXJhdG9ycyc7XG5pbXBvcnQgU3ludGF4LCB7IEFMTF9QSEFTRVMgfSBmcm9tICcuL3N5bnRheCc7XG5pbXBvcnQgdHlwZSB7IFN5bWJvbENsYXNzIH0gZnJvbSAnLi9zeW1ib2wnO1xuXG5pbXBvcnQgeyBmcmVzaFNjb3BlIH0gZnJvbSAnLi9zY29wZSc7XG5pbXBvcnQgeyBzYW5pdGl6ZVJlcGxhY2VtZW50VmFsdWVzIH0gZnJvbSAnLi9sb2FkLXN5bnRheCc7XG5cbmltcG9ydCBNYWNyb0NvbnRleHQgZnJvbSAnLi9tYWNyby1jb250ZXh0JztcblxuY29uc3QgRVhQUl9MT09QX09QRVJBVE9SID0ge307XG5jb25zdCBFWFBSX0xPT1BfTk9fQ0hBTkdFID0ge307XG5jb25zdCBFWFBSX0xPT1BfRVhQQU5TSU9OID0ge307XG5cbmZ1bmN0aW9uIGdldExpbmVOdW1iZXIoeDogYW55KSB7XG4gIGxldCBzdHg7XG4gIGlmICh4IGluc3RhbmNlb2YgU3ludGF4KSB7XG4gICAgc3R4ID0geDtcbiAgfSBlbHNlIGlmICh4IGluc3RhbmNlb2YgVC5SYXdTeW50YXgpIHtcbiAgICBzdHggPSB4LnZhbHVlO1xuICB9IGVsc2UgaWYgKHggaW5zdGFuY2VvZiBULlJhd0RlbGltaXRlcikge1xuICAgIHJldHVybiBnZXRMaW5lTnVtYmVyKHguaW5uZXIuZmlyc3QoKSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBOb3QgaW1wbGVtZW50ZWQgeWV0ICR7eH1gKTtcbiAgfVxuICByZXR1cm4gc3R4LmxpbmVOdW1iZXIoKTtcbn1cblxuZXhwb3J0IGNsYXNzIEVuZm9yZXN0ZXIge1xuICBkb25lOiBib29sZWFuO1xuICB0ZXJtOiA/VGVybTtcbiAgcmVzdDogTGlzdDxUZXJtPjtcbiAgcHJldjogTGlzdDxUZXJtPjtcbiAgY29udGV4dDoge1xuICAgIGVudjogTWFwPHN0cmluZywgYW55PixcbiAgICBzdG9yZTogTWFwPHN0cmluZywgYW55PixcbiAgICBwaGFzZTogbnVtYmVyIHwge30sXG4gICAgdXNlU2NvcGU6IFN5bWJvbENsYXNzLFxuICAgIGJpbmRpbmdzOiBhbnksXG4gICAgYWxsb3dBd2FpdD86IGJvb2xlYW4sXG4gIH07XG4gIG9wQ3R4OiB7XG4gICAgcHJlYzogbnVtYmVyLFxuICAgIGNvbWJpbmU6ICh4OiBhbnkpID0+IGFueSxcbiAgICBzdGFjazogTGlzdDwqPixcbiAgfTtcblxuICBjb25zdHJ1Y3RvcihzdHhsOiBMaXN0PFRlcm0+LCBwcmV2OiBMaXN0PFRlcm0+LCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgICBhc3NlcnQoTGlzdC5pc0xpc3Qoc3R4bCksICdleHBlY3RpbmcgYSBsaXN0IG9mIHRlcm1zIHRvIGVuZm9yZXN0Jyk7XG4gICAgYXNzZXJ0KExpc3QuaXNMaXN0KHByZXYpLCAnZXhwZWN0aW5nIGEgbGlzdCBvZiB0ZXJtcyB0byBlbmZvcmVzdCcpO1xuICAgIGFzc2VydChjb250ZXh0LCAnZXhwZWN0aW5nIGEgY29udGV4dCB0byBlbmZvcmVzdCcpO1xuICAgIHRoaXMudGVybSA9IG51bGw7XG5cbiAgICB0aGlzLnJlc3QgPSBzdHhsO1xuICAgIHRoaXMucHJldiA9IHByZXY7XG5cbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICB9XG5cbiAgcGVlayhuOiBudW1iZXIgPSAwKTogP1Rlcm0ge1xuICAgIHJldHVybiB0aGlzLnJlc3QuZ2V0KG4pO1xuICB9XG5cbiAgYWR2YW5jZSgpIHtcbiAgICBsZXQgcmV0OiA/VGVybSA9IHRoaXMucmVzdC5maXJzdCgpO1xuICAgIHRoaXMucmVzdCA9IHRoaXMucmVzdC5yZXN0KCk7XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8qXG4gICBlbmZvcmVzdCB3b3JrcyBvdmVyOlxuICAgcHJldiAtIGEgbGlzdCBvZiB0aGUgcHJldmlvdXNseSBlbmZvcmVzdCBUZXJtc1xuICAgdGVybSAtIHRoZSBjdXJyZW50IHRlcm0gYmVpbmcgZW5mb3Jlc3RlZCAoaW5pdGlhbGx5IG51bGwpXG4gICByZXN0IC0gcmVtYWluaW5nIFRlcm1zIHRvIGVuZm9yZXN0XG4gICAqL1xuICBlbmZvcmVzdCh0eXBlPzogJ2V4cHJlc3Npb24nIHwgJ01vZHVsZScgPSAnTW9kdWxlJykge1xuICAgIC8vIGluaXRpYWxpemUgdGhlIHRlcm1cbiAgICB0aGlzLnRlcm0gPSBudWxsO1xuXG4gICAgaWYgKHRoaXMucmVzdC5zaXplID09PSAwKSB7XG4gICAgICB0aGlzLmRvbmUgPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMudGVybTtcbiAgICB9XG5cbiAgICBsZXQgcmVzdWx0O1xuICAgIGlmICh0eXBlID09PSAnZXhwcmVzc2lvbicpIHtcbiAgICAgIHJlc3VsdCA9IHRoaXMuZW5mb3Jlc3RFeHByZXNzaW9uTG9vcCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSB0aGlzLmVuZm9yZXN0TW9kdWxlKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucmVzdC5zaXplID09PSAwKSB7XG4gICAgICB0aGlzLmRvbmUgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgZW5mb3Jlc3RNb2R1bGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RCb2R5KCk7XG4gIH1cblxuICBlbmZvcmVzdEJvZHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RNb2R1bGVJdGVtKCk7XG4gIH1cblxuICBlbmZvcmVzdE1vZHVsZUl0ZW0oKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuXG4gICAgaWYgKHRoaXMuaXNJbXBvcnRUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdEltcG9ydERlY2xhcmF0aW9uKCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzRXhwb3J0VHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RFeHBvcnREZWNsYXJhdGlvbigpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5lbmZvcmVzdFN0YXRlbWVudCgpO1xuICB9XG5cbiAgZW5mb3Jlc3RFeHBvcnREZWNsYXJhdGlvbigpIHtcbiAgICBsZXQgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG4gICAgaWYgKHRoaXMuaXNDb21waWxldGltZVRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICB0aGlzLmV4cGFuZE1hY3JvKCk7XG4gICAgICBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc1B1bmN0dWF0b3IobG9va2FoZWFkLCAnKicpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgVC5FeHBvcnRBbGxGcm9tKHtcbiAgICAgICAgbW9kdWxlU3BlY2lmaWVyOiB0aGlzLmVuZm9yZXN0RnJvbUNsYXVzZSgpLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzQnJhY2VzKGxvb2thaGVhZCkpIHtcbiAgICAgIGxldCBuYW1lZEV4cG9ydHMgPSB0aGlzLmVuZm9yZXN0RXhwb3J0Q2xhdXNlKCk7XG4gICAgICBpZiAodGhpcy5pc0lkZW50aWZpZXIodGhpcy5wZWVrKCksICdmcm9tJykpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBULkV4cG9ydEZyb20oe1xuICAgICAgICAgIG5hbWVkRXhwb3J0czogbmFtZWRFeHBvcnRzLm1hcChzID0+IG5ldyBULkV4cG9ydEZyb21TcGVjaWZpZXIocykpLFxuICAgICAgICAgIG1vZHVsZVNwZWNpZmllcjogdGhpcy5lbmZvcmVzdEZyb21DbGF1c2UoKSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IFQuRXhwb3J0TG9jYWxzKHtcbiAgICAgICAgbmFtZWRFeHBvcnRzOiBuYW1lZEV4cG9ydHMubWFwKFxuICAgICAgICAgIHMgPT5cbiAgICAgICAgICAgIG5ldyBULkV4cG9ydExvY2FsU3BlY2lmaWVyKHtcbiAgICAgICAgICAgICAgbmFtZTogbmV3IFQuSWRlbnRpZmllckV4cHJlc3Npb24oe1xuICAgICAgICAgICAgICAgIG5hbWU6IHMubmFtZSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgIGV4cG9ydGVkTmFtZTogcy5leHBvcnRlZE5hbWUsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgKSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc0NsYXNzVHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiBuZXcgVC5FeHBvcnQoe1xuICAgICAgICBkZWNsYXJhdGlvbjogdGhpcy5lbmZvcmVzdENsYXNzKHtcbiAgICAgICAgICBpc0V4cHI6IGZhbHNlLFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc0ZuRGVjbFRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gbmV3IFQuRXhwb3J0KHtcbiAgICAgICAgZGVjbGFyYXRpb246IHRoaXMuZW5mb3Jlc3RGdW5jdGlvbih7XG4gICAgICAgICAgaXNFeHByOiBmYWxzZSxcbiAgICAgICAgfSksXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgdGhpcy5pc0FzeW5jVHJhbnNmb3JtKGxvb2thaGVhZCkgJiZcbiAgICAgIHRoaXMuaXNGbkRlY2xUcmFuc2Zvcm0odGhpcy5wZWVrKDEpKSAmJlxuICAgICAgdGhpcy5saW5lTnVtYmVyRXEobG9va2FoZWFkLCB0aGlzLnBlZWsoMSkpXG4gICAgKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgVC5FeHBvcnQoe1xuICAgICAgICBkZWNsYXJhdGlvbjogdGhpcy5lbmZvcmVzdEZ1bmN0aW9uKHtcbiAgICAgICAgICBpc0V4cHI6IGZhbHNlLFxuICAgICAgICAgIGlzQXN5bmM6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzRGVmYXVsdFRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIGlmICh0aGlzLmlzQ29tcGlsZXRpbWVUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAgICB0aGlzLmV4cGFuZE1hY3JvKCk7XG4gICAgICAgIGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5pc0ZuRGVjbFRyYW5zZm9ybSh0aGlzLnBlZWsoKSkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBULkV4cG9ydERlZmF1bHQoe1xuICAgICAgICAgIGJvZHk6IHRoaXMuZW5mb3Jlc3RGdW5jdGlvbih7XG4gICAgICAgICAgICBpc0V4cHI6IGZhbHNlLFxuICAgICAgICAgICAgaW5EZWZhdWx0OiB0cnVlLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHRoaXMuaXNBc3luY1RyYW5zZm9ybShsb29rYWhlYWQpICYmXG4gICAgICAgIHRoaXMuaXNGbkRlY2xUcmFuc2Zvcm0odGhpcy5wZWVrKDEpKSAmJlxuICAgICAgICB0aGlzLmxpbmVOdW1iZXJFcShsb29rYWhlYWQsIHRoaXMucGVlaygxKSlcbiAgICAgICkge1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgcmV0dXJuIG5ldyBULkV4cG9ydERlZmF1bHQoe1xuICAgICAgICAgIGJvZHk6IHRoaXMuZW5mb3Jlc3RGdW5jdGlvbih7XG4gICAgICAgICAgICBpc0V4cHI6IGZhbHNlLFxuICAgICAgICAgICAgaW5EZWZhdWx0OiB0cnVlLFxuICAgICAgICAgICAgaXNBc3luYzogdHJ1ZSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNDbGFzc1RyYW5zZm9ybSh0aGlzLnBlZWsoKSkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBULkV4cG9ydERlZmF1bHQoe1xuICAgICAgICAgIGJvZHk6IHRoaXMuZW5mb3Jlc3RDbGFzcyh7XG4gICAgICAgICAgICBpc0V4cHI6IGZhbHNlLFxuICAgICAgICAgICAgaW5EZWZhdWx0OiB0cnVlLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBib2R5ID0gdGhpcy5lbmZvcmVzdEV4cHJlc3Npb25Mb29wKCk7XG4gICAgICAgIHRoaXMuY29uc3VtZVNlbWljb2xvbigpO1xuICAgICAgICByZXR1cm4gbmV3IFQuRXhwb3J0RGVmYXVsdCh7XG4gICAgICAgICAgYm9keSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIHRoaXMuaXNWYXJEZWNsVHJhbnNmb3JtKGxvb2thaGVhZCkgfHxcbiAgICAgIHRoaXMuaXNMZXREZWNsVHJhbnNmb3JtKGxvb2thaGVhZCkgfHxcbiAgICAgIHRoaXMuaXNDb25zdERlY2xUcmFuc2Zvcm0obG9va2FoZWFkKSB8fFxuICAgICAgdGhpcy5pc1N5bnRheHJlY0RlY2xUcmFuc2Zvcm0obG9va2FoZWFkKSB8fFxuICAgICAgdGhpcy5pc1N5bnRheERlY2xUcmFuc2Zvcm0obG9va2FoZWFkKSB8fFxuICAgICAgdGhpcy5pc09wZXJhdG9yRGVjbFRyYW5zZm9ybShsb29rYWhlYWQpXG4gICAgKSB7XG4gICAgICByZXR1cm4gbmV3IFQuRXhwb3J0KHtcbiAgICAgICAgZGVjbGFyYXRpb246IHRoaXMuZW5mb3Jlc3RWYXJpYWJsZURlY2xhcmF0aW9uKCksXG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhyb3cgdGhpcy5jcmVhdGVFcnJvcihsb29rYWhlYWQsICd1bmV4cGVjdGVkIHN5bnRheCcpO1xuICB9XG5cbiAgZW5mb3Jlc3RFeHBvcnRDbGF1c2UoKSB7XG4gICAgbGV0IGVuZiA9IG5ldyBFbmZvcmVzdGVyKHRoaXMubWF0Y2hDdXJsaWVzKCksIExpc3QoKSwgdGhpcy5jb250ZXh0KTtcbiAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgd2hpbGUgKGVuZi5yZXN0LnNpemUgIT09IDApIHtcbiAgICAgIHJlc3VsdC5wdXNoKGVuZi5lbmZvcmVzdEV4cG9ydFNwZWNpZmllcigpKTtcbiAgICAgIGVuZi5jb25zdW1lQ29tbWEoKTtcbiAgICB9XG4gICAgcmV0dXJuIExpc3QocmVzdWx0KTtcbiAgfVxuXG4gIGVuZm9yZXN0RXhwb3J0U3BlY2lmaWVyKCkge1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmVuZm9yZXN0SWRlbnRpZmllcigpO1xuICAgIGxldCBleHBvcnRlZE5hbWUgPSBudWxsO1xuICAgIGlmICh0aGlzLmlzSWRlbnRpZmllcih0aGlzLnBlZWsoKSwgJ2FzJykpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgZXhwb3J0ZWROYW1lID0gdGhpcy5lbmZvcmVzdElkZW50aWZpZXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWUsXG4gICAgICBleHBvcnRlZE5hbWUsXG4gICAgfTtcbiAgfVxuXG4gIGVuZm9yZXN0SW1wb3J0RGVjbGFyYXRpb24oKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgIGxldCBkZWZhdWx0QmluZGluZyA9IG51bGw7XG4gICAgbGV0IG5hbWVkSW1wb3J0cyA9IExpc3QoKTtcbiAgICBsZXQgZm9yU3ludGF4ID0gZmFsc2U7XG5cbiAgICBpZiAodGhpcy5pc1N0cmluZ0xpdGVyYWwobG9va2FoZWFkKSkge1xuICAgICAgbGV0IG1vZHVsZVNwZWNpZmllciA9IHRoaXMuYWR2YW5jZSgpO1xuICAgICAgdGhpcy5jb25zdW1lU2VtaWNvbG9uKCk7XG4gICAgICByZXR1cm4gbmV3IFQuSW1wb3J0KHtcbiAgICAgICAgZGVmYXVsdEJpbmRpbmcsXG4gICAgICAgIG5hbWVkSW1wb3J0cyxcbiAgICAgICAgbW9kdWxlU3BlY2lmaWVyLFxuICAgICAgICBmb3JTeW50YXgsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc0lkZW50aWZpZXIobG9va2FoZWFkKSB8fCB0aGlzLmlzS2V5d29yZChsb29rYWhlYWQpKSB7XG4gICAgICBkZWZhdWx0QmluZGluZyA9IHRoaXMuZW5mb3Jlc3RCaW5kaW5nSWRlbnRpZmllcigpO1xuICAgICAgaWYgKCF0aGlzLmlzUHVuY3R1YXRvcih0aGlzLnBlZWsoKSwgJywnKSkge1xuICAgICAgICBsZXQgbW9kdWxlU3BlY2lmaWVyID0gdGhpcy5lbmZvcmVzdEZyb21DbGF1c2UoKTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHRoaXMuaXNLZXl3b3JkKHRoaXMucGVlaygpLCAnZm9yJykgJiZcbiAgICAgICAgICB0aGlzLmlzSWRlbnRpZmllcih0aGlzLnBlZWsoMSksICdzeW50YXgnKVxuICAgICAgICApIHtcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBmb3JTeW50YXggPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBULkltcG9ydCh7XG4gICAgICAgICAgZGVmYXVsdEJpbmRpbmcsXG4gICAgICAgICAgbW9kdWxlU3BlY2lmaWVyLFxuICAgICAgICAgIG5hbWVkSW1wb3J0czogTGlzdCgpLFxuICAgICAgICAgIGZvclN5bnRheCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuY29uc3VtZUNvbW1hKCk7XG4gICAgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG4gICAgaWYgKHRoaXMuaXNCcmFjZXMobG9va2FoZWFkKSkge1xuICAgICAgbGV0IGltcG9ydHMgPSB0aGlzLmVuZm9yZXN0TmFtZWRJbXBvcnRzKCk7XG4gICAgICBsZXQgZnJvbUNsYXVzZSA9IHRoaXMuZW5mb3Jlc3RGcm9tQ2xhdXNlKCk7XG4gICAgICBpZiAoXG4gICAgICAgIHRoaXMuaXNLZXl3b3JkKHRoaXMucGVlaygpLCAnZm9yJykgJiZcbiAgICAgICAgdGhpcy5pc0lkZW50aWZpZXIodGhpcy5wZWVrKDEpLCAnc3ludGF4JylcbiAgICAgICkge1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIGZvclN5bnRheCA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBuZXcgVC5JbXBvcnQoe1xuICAgICAgICBkZWZhdWx0QmluZGluZyxcbiAgICAgICAgZm9yU3ludGF4LFxuICAgICAgICBuYW1lZEltcG9ydHM6IGltcG9ydHMsXG4gICAgICAgIG1vZHVsZVNwZWNpZmllcjogZnJvbUNsYXVzZSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc1B1bmN0dWF0b3IobG9va2FoZWFkLCAnKicpKSB7XG4gICAgICBsZXQgbmFtZXNwYWNlQmluZGluZyA9IHRoaXMuZW5mb3Jlc3ROYW1lc3BhY2VCaW5kaW5nKCk7XG4gICAgICBsZXQgbW9kdWxlU3BlY2lmaWVyID0gdGhpcy5lbmZvcmVzdEZyb21DbGF1c2UoKTtcbiAgICAgIGlmIChcbiAgICAgICAgdGhpcy5pc0tleXdvcmQodGhpcy5wZWVrKCksICdmb3InKSAmJlxuICAgICAgICB0aGlzLmlzSWRlbnRpZmllcih0aGlzLnBlZWsoMSksICdzeW50YXgnKVxuICAgICAgKSB7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgZm9yU3ludGF4ID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgVC5JbXBvcnROYW1lc3BhY2Uoe1xuICAgICAgICBkZWZhdWx0QmluZGluZyxcbiAgICAgICAgZm9yU3ludGF4LFxuICAgICAgICBuYW1lc3BhY2VCaW5kaW5nLFxuICAgICAgICBtb2R1bGVTcGVjaWZpZXIsXG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhyb3cgdGhpcy5jcmVhdGVFcnJvcihsb29rYWhlYWQsICd1bmV4cGVjdGVkIHN5bnRheCcpO1xuICB9XG5cbiAgZW5mb3Jlc3ROYW1lc3BhY2VCaW5kaW5nKCkge1xuICAgIHRoaXMubWF0Y2hQdW5jdHVhdG9yKCcqJyk7XG4gICAgdGhpcy5tYXRjaElkZW50aWZpZXIoJ2FzJyk7XG4gICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RCaW5kaW5nSWRlbnRpZmllcigpO1xuICB9XG5cbiAgZW5mb3Jlc3ROYW1lZEltcG9ydHMoKSB7XG4gICAgbGV0IGVuZiA9IG5ldyBFbmZvcmVzdGVyKHRoaXMubWF0Y2hDdXJsaWVzKCksIExpc3QoKSwgdGhpcy5jb250ZXh0KTtcbiAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgd2hpbGUgKGVuZi5yZXN0LnNpemUgIT09IDApIHtcbiAgICAgIHJlc3VsdC5wdXNoKGVuZi5lbmZvcmVzdEltcG9ydFNwZWNpZmllcnMoKSk7XG4gICAgICBlbmYuY29uc3VtZUNvbW1hKCk7XG4gICAgfVxuICAgIHJldHVybiBMaXN0KHJlc3VsdCk7XG4gIH1cblxuICBlbmZvcmVzdEltcG9ydFNwZWNpZmllcnMoKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgIGxldCBuYW1lO1xuICAgIGlmIChcbiAgICAgIHRoaXMuaXNJZGVudGlmaWVyKGxvb2thaGVhZCkgfHxcbiAgICAgIHRoaXMuaXNLZXl3b3JkKGxvb2thaGVhZCkgfHxcbiAgICAgIHRoaXMuaXNQdW5jdHVhdG9yKGxvb2thaGVhZClcbiAgICApIHtcbiAgICAgIG5hbWUgPSB0aGlzLm1hdGNoUmF3U3ludGF4KCk7XG4gICAgICBpZiAoIXRoaXMuaXNJZGVudGlmaWVyKHRoaXMucGVlaygpLCAnYXMnKSkge1xuICAgICAgICByZXR1cm4gbmV3IFQuSW1wb3J0U3BlY2lmaWVyKHtcbiAgICAgICAgICBuYW1lOiBudWxsLFxuICAgICAgICAgIGJpbmRpbmc6IG5ldyBULkJpbmRpbmdJZGVudGlmaWVyKHtcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5tYXRjaElkZW50aWZpZXIoJ2FzJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IobG9va2FoZWFkLCAndW5leHBlY3RlZCB0b2tlbiBpbiBpbXBvcnQgc3BlY2lmaWVyJyk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgVC5JbXBvcnRTcGVjaWZpZXIoe1xuICAgICAgbmFtZSxcbiAgICAgIGJpbmRpbmc6IHRoaXMuZW5mb3Jlc3RCaW5kaW5nSWRlbnRpZmllcigpLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RGcm9tQ2xhdXNlKCkge1xuICAgIHRoaXMubWF0Y2hJZGVudGlmaWVyKCdmcm9tJyk7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMubWF0Y2hTdHJpbmdMaXRlcmFsKCk7XG4gICAgdGhpcy5jb25zdW1lU2VtaWNvbG9uKCk7XG4gICAgcmV0dXJuIGxvb2thaGVhZDtcbiAgfVxuXG4gIGVuZm9yZXN0U3RhdGVtZW50TGlzdEl0ZW0oKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuXG4gICAgaWYgKHRoaXMuaXNGbkRlY2xUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RGdW5jdGlvbih7XG4gICAgICAgIGlzRXhwcjogZmFsc2UsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgdGhpcy5pc0FzeW5jVHJhbnNmb3JtKGxvb2thaGVhZCkgJiZcbiAgICAgIHRoaXMuaXNGbkRlY2xUcmFuc2Zvcm0odGhpcy5wZWVrKDEpKSAmJlxuICAgICAgdGhpcy5saW5lTnVtYmVyRXEobG9va2FoZWFkLCB0aGlzLnBlZWsoMSkpXG4gICAgKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0RnVuY3Rpb24oe1xuICAgICAgICBpc0V4cHI6IGZhbHNlLFxuICAgICAgICBpc0FzeW5jOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzQ2xhc3NUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RDbGFzcyh7XG4gICAgICAgIGlzRXhwcjogZmFsc2UsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RTdGF0ZW1lbnQoKTtcbiAgICB9XG4gIH1cblxuICBlbmZvcmVzdFN0YXRlbWVudCgpIHtcbiAgICBsZXQgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG5cbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNDb21waWxldGltZVRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICB0aGlzLmV4cGFuZE1hY3JvKCk7XG4gICAgICBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0aGlzLnRlcm0gPT09IG51bGwgJiZcbiAgICAgIHRoaXMuaXNUZXJtKGxvb2thaGVhZCkgJiZcbiAgICAgIGxvb2thaGVhZCBpbnN0YW5jZW9mIFQuU3RhdGVtZW50XG4gICAgKSB7XG4gICAgICAvLyBUT0RPOiBjaGVjayB0aGF0IHRoaXMgaXMgYWN0dWFsbHkgYW4gc3RhdGVtZW50XG4gICAgICByZXR1cm4gdGhpcy5hZHZhbmNlKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzQnJhY2VzKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0QmxvY2tTdGF0ZW1lbnQoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNXaGlsZVRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdFdoaWxlU3RhdGVtZW50KCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzSWZUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RJZlN0YXRlbWVudCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNGb3JUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RGb3JTdGF0ZW1lbnQoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzU3dpdGNoVHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0U3dpdGNoU3RhdGVtZW50KCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnRlcm0gPT09IG51bGwgJiYgdGhpcy5pc0JyZWFrVHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0QnJlYWtTdGF0ZW1lbnQoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzQ29udGludWVUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RDb250aW51ZVN0YXRlbWVudCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNEb1RyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdERvU3RhdGVtZW50KCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnRlcm0gPT09IG51bGwgJiYgdGhpcy5pc0RlYnVnZ2VyVHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0RGVidWdnZXJTdGF0ZW1lbnQoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzV2l0aFRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdFdpdGhTdGF0ZW1lbnQoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzVHJ5VHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0VHJ5U3RhdGVtZW50KCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnRlcm0gPT09IG51bGwgJiYgdGhpcy5pc1Rocm93VHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0VGhyb3dTdGF0ZW1lbnQoKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBwdXQgc29tZXdoZXJlIGVsc2VcbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNLZXl3b3JkKGxvb2thaGVhZCwgJ2NsYXNzJykpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0Q2xhc3Moe1xuICAgICAgICBpc0V4cHI6IGZhbHNlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzRm5EZWNsVHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0RnVuY3Rpb24oe1xuICAgICAgICBpc0V4cHI6IGZhbHNlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdGhpcy50ZXJtID09PSBudWxsICYmXG4gICAgICB0aGlzLmlzQXN5bmNUcmFuc2Zvcm0obG9va2FoZWFkKSAmJlxuICAgICAgdGhpcy5pc0ZuRGVjbFRyYW5zZm9ybSh0aGlzLnBlZWsoMSkpICYmXG4gICAgICB0aGlzLmxpbmVOdW1iZXJFcShsb29rYWhlYWQsIHRoaXMucGVlaygxKSlcbiAgICApIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RGdW5jdGlvbih7XG4gICAgICAgIGlzRXhwcjogZmFsc2UsXG4gICAgICAgIGlzQXN5bmM6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0aGlzLnRlcm0gPT09IG51bGwgJiZcbiAgICAgIHRoaXMuaXNJZGVudGlmaWVyKGxvb2thaGVhZCkgJiZcbiAgICAgIHRoaXMuaXNQdW5jdHVhdG9yKHRoaXMucGVlaygxKSwgJzonKVxuICAgICkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RMYWJlbGVkU3RhdGVtZW50KCk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdGhpcy50ZXJtID09PSBudWxsICYmXG4gICAgICAodGhpcy5pc1ZhckRlY2xUcmFuc2Zvcm0obG9va2FoZWFkKSB8fFxuICAgICAgICB0aGlzLmlzTGV0RGVjbFRyYW5zZm9ybShsb29rYWhlYWQpIHx8XG4gICAgICAgIHRoaXMuaXNDb25zdERlY2xUcmFuc2Zvcm0obG9va2FoZWFkKSB8fFxuICAgICAgICB0aGlzLmlzU3ludGF4cmVjRGVjbFRyYW5zZm9ybShsb29rYWhlYWQpIHx8XG4gICAgICAgIHRoaXMuaXNTeW50YXhEZWNsVHJhbnNmb3JtKGxvb2thaGVhZCkgfHxcbiAgICAgICAgdGhpcy5pc09wZXJhdG9yRGVjbFRyYW5zZm9ybShsb29rYWhlYWQpKVxuICAgICkge1xuICAgICAgbGV0IHN0bXQgPSBuZXcgVC5WYXJpYWJsZURlY2xhcmF0aW9uU3RhdGVtZW50KHtcbiAgICAgICAgZGVjbGFyYXRpb246IHRoaXMuZW5mb3Jlc3RWYXJpYWJsZURlY2xhcmF0aW9uKCksXG4gICAgICB9KTtcbiAgICAgIHRoaXMuY29uc3VtZVNlbWljb2xvbigpO1xuICAgICAgcmV0dXJuIHN0bXQ7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzUmV0dXJuU3RtdFRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdFJldHVyblN0YXRlbWVudCgpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnRlcm0gPT09IG51bGwgJiYgdGhpcy5pc1B1bmN0dWF0b3IobG9va2FoZWFkLCAnOycpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgVC5FbXB0eVN0YXRlbWVudCh7fSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RFeHByZXNzaW9uU3RhdGVtZW50KCk7XG4gIH1cblxuICBlbmZvcmVzdExhYmVsZWRTdGF0ZW1lbnQoKSB7XG4gICAgbGV0IGxhYmVsID0gdGhpcy5tYXRjaElkZW50aWZpZXIoKTtcbiAgICB0aGlzLm1hdGNoUHVuY3R1YXRvcignOicpO1xuICAgIGxldCBzdG10ID0gdGhpcy5lbmZvcmVzdFN0YXRlbWVudCgpO1xuXG4gICAgcmV0dXJuIG5ldyBULkxhYmVsZWRTdGF0ZW1lbnQoe1xuICAgICAgbGFiZWw6IGxhYmVsLFxuICAgICAgYm9keTogc3RtdCxcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yZXN0QnJlYWtTdGF0ZW1lbnQoKSB7XG4gICAgdGhpcy5tYXRjaEtleXdvcmQoJ2JyZWFrJyk7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgIGxldCBsYWJlbCA9IG51bGw7XG4gICAgaWYgKHRoaXMucmVzdC5zaXplID09PSAwIHx8IHRoaXMuaXNQdW5jdHVhdG9yKGxvb2thaGVhZCwgJzsnKSkge1xuICAgICAgdGhpcy5jb25zdW1lU2VtaWNvbG9uKCk7XG4gICAgICByZXR1cm4gbmV3IFQuQnJlYWtTdGF0ZW1lbnQoe1xuICAgICAgICBsYWJlbCxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoXG4gICAgICB0aGlzLmlzSWRlbnRpZmllcihsb29rYWhlYWQpIHx8XG4gICAgICB0aGlzLmlzS2V5d29yZChsb29rYWhlYWQsICd5aWVsZCcpIHx8XG4gICAgICB0aGlzLmlzS2V5d29yZChsb29rYWhlYWQsICdsZXQnKVxuICAgICkge1xuICAgICAgbGFiZWwgPSB0aGlzLmVuZm9yZXN0SWRlbnRpZmllcigpO1xuICAgIH1cbiAgICB0aGlzLmNvbnN1bWVTZW1pY29sb24oKTtcblxuICAgIHJldHVybiBuZXcgVC5CcmVha1N0YXRlbWVudCh7XG4gICAgICBsYWJlbCxcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yZXN0VHJ5U3RhdGVtZW50KCkge1xuICAgIHRoaXMubWF0Y2hLZXl3b3JkKCd0cnknKTtcbiAgICBsZXQgYm9keSA9IHRoaXMuZW5mb3Jlc3RCbG9jaygpO1xuICAgIGlmICh0aGlzLmlzS2V5d29yZCh0aGlzLnBlZWsoKSwgJ2NhdGNoJykpIHtcbiAgICAgIGxldCBjYXRjaENsYXVzZSA9IHRoaXMuZW5mb3Jlc3RDYXRjaENsYXVzZSgpO1xuICAgICAgaWYgKHRoaXMuaXNLZXl3b3JkKHRoaXMucGVlaygpLCAnZmluYWxseScpKSB7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICBsZXQgZmluYWxpemVyID0gdGhpcy5lbmZvcmVzdEJsb2NrKCk7XG4gICAgICAgIHJldHVybiBuZXcgVC5UcnlGaW5hbGx5U3RhdGVtZW50KHtcbiAgICAgICAgICBib2R5LFxuICAgICAgICAgIGNhdGNoQ2xhdXNlLFxuICAgICAgICAgIGZpbmFsaXplcixcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IFQuVHJ5Q2F0Y2hTdGF0ZW1lbnQoe1xuICAgICAgICBib2R5LFxuICAgICAgICBjYXRjaENsYXVzZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAodGhpcy5pc0tleXdvcmQodGhpcy5wZWVrKCksICdmaW5hbGx5JykpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgbGV0IGZpbmFsaXplciA9IHRoaXMuZW5mb3Jlc3RCbG9jaygpO1xuICAgICAgcmV0dXJuIG5ldyBULlRyeUZpbmFsbHlTdGF0ZW1lbnQoe1xuICAgICAgICBib2R5LFxuICAgICAgICBjYXRjaENsYXVzZTogbnVsbCxcbiAgICAgICAgZmluYWxpemVyLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IodGhpcy5wZWVrKCksICd0cnkgd2l0aCBubyBjYXRjaCBvciBmaW5hbGx5Jyk7XG4gIH1cblxuICBlbmZvcmVzdENhdGNoQ2xhdXNlKCkge1xuICAgIHRoaXMubWF0Y2hLZXl3b3JkKCdjYXRjaCcpO1xuICAgIGxldCBiaW5kaW5nUGFyZW5zID0gdGhpcy5tYXRjaFBhcmVucygpO1xuICAgIGxldCBlbmYgPSBuZXcgRW5mb3Jlc3RlcihiaW5kaW5nUGFyZW5zLCBMaXN0KCksIHRoaXMuY29udGV4dCk7XG4gICAgbGV0IGJpbmRpbmcgPSBlbmYuZW5mb3Jlc3RCaW5kaW5nVGFyZ2V0KCk7XG4gICAgbGV0IGJvZHkgPSB0aGlzLmVuZm9yZXN0QmxvY2soKTtcbiAgICByZXR1cm4gbmV3IFQuQ2F0Y2hDbGF1c2Uoe1xuICAgICAgYmluZGluZyxcbiAgICAgIGJvZHksXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmVzdFRocm93U3RhdGVtZW50KCkge1xuICAgIHRoaXMubWF0Y2hLZXl3b3JkKCd0aHJvdycpO1xuICAgIGxldCBleHByZXNzaW9uID0gdGhpcy5lbmZvcmVzdEV4cHJlc3Npb24oKTtcbiAgICB0aGlzLmNvbnN1bWVTZW1pY29sb24oKTtcbiAgICByZXR1cm4gbmV3IFQuVGhyb3dTdGF0ZW1lbnQoe1xuICAgICAgZXhwcmVzc2lvbixcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yZXN0V2l0aFN0YXRlbWVudCgpIHtcbiAgICB0aGlzLm1hdGNoS2V5d29yZCgnd2l0aCcpO1xuICAgIGxldCBvYmpQYXJlbnMgPSB0aGlzLm1hdGNoUGFyZW5zKCk7XG4gICAgbGV0IGVuZiA9IG5ldyBFbmZvcmVzdGVyKG9ialBhcmVucywgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuICAgIGxldCBvYmplY3QgPSBlbmYuZW5mb3Jlc3RFeHByZXNzaW9uKCk7XG4gICAgbGV0IGJvZHkgPSB0aGlzLmVuZm9yZXN0U3RhdGVtZW50KCk7XG4gICAgcmV0dXJuIG5ldyBULldpdGhTdGF0ZW1lbnQoe1xuICAgICAgb2JqZWN0LFxuICAgICAgYm9keSxcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yZXN0RGVidWdnZXJTdGF0ZW1lbnQoKSB7XG4gICAgdGhpcy5tYXRjaEtleXdvcmQoJ2RlYnVnZ2VyJyk7XG5cbiAgICByZXR1cm4gbmV3IFQuRGVidWdnZXJTdGF0ZW1lbnQoe30pO1xuICB9XG5cbiAgZW5mb3Jlc3REb1N0YXRlbWVudCgpIHtcbiAgICB0aGlzLm1hdGNoS2V5d29yZCgnZG8nKTtcbiAgICBsZXQgYm9keSA9IHRoaXMuZW5mb3Jlc3RTdGF0ZW1lbnQoKTtcbiAgICB0aGlzLm1hdGNoS2V5d29yZCgnd2hpbGUnKTtcbiAgICBsZXQgdGVzdEJvZHkgPSB0aGlzLm1hdGNoUGFyZW5zKCk7XG4gICAgbGV0IGVuZiA9IG5ldyBFbmZvcmVzdGVyKHRlc3RCb2R5LCBMaXN0KCksIHRoaXMuY29udGV4dCk7XG4gICAgbGV0IHRlc3QgPSBlbmYuZW5mb3Jlc3RFeHByZXNzaW9uKCk7XG4gICAgdGhpcy5jb25zdW1lU2VtaWNvbG9uKCk7XG4gICAgcmV0dXJuIG5ldyBULkRvV2hpbGVTdGF0ZW1lbnQoe1xuICAgICAgYm9keSxcbiAgICAgIHRlc3QsXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmVzdENvbnRpbnVlU3RhdGVtZW50KCkge1xuICAgIGxldCBrd2QgPSB0aGlzLm1hdGNoS2V5d29yZCgnY29udGludWUnKTtcbiAgICBsZXQgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG4gICAgbGV0IGxhYmVsID0gbnVsbDtcbiAgICBpZiAodGhpcy5yZXN0LnNpemUgPT09IDAgfHwgdGhpcy5pc1B1bmN0dWF0b3IobG9va2FoZWFkLCAnOycpKSB7XG4gICAgICB0aGlzLmNvbnN1bWVTZW1pY29sb24oKTtcbiAgICAgIHJldHVybiBuZXcgVC5Db250aW51ZVN0YXRlbWVudCh7XG4gICAgICAgIGxhYmVsLFxuICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChcbiAgICAgIGxvb2thaGVhZCBpbnN0YW5jZW9mIFQuUmF3U3ludGF4ICYmXG4gICAgICB0aGlzLmxpbmVOdW1iZXJFcShrd2QsIGxvb2thaGVhZCkgJiZcbiAgICAgICh0aGlzLmlzSWRlbnRpZmllcihsb29rYWhlYWQpIHx8XG4gICAgICAgIHRoaXMuaXNLZXl3b3JkKGxvb2thaGVhZCwgJ3lpZWxkJykgfHxcbiAgICAgICAgdGhpcy5pc0tleXdvcmQobG9va2FoZWFkLCAnbGV0JykpXG4gICAgKSB7XG4gICAgICBsYWJlbCA9IHRoaXMuZW5mb3Jlc3RJZGVudGlmaWVyKCk7XG4gICAgfVxuICAgIHRoaXMuY29uc3VtZVNlbWljb2xvbigpO1xuXG4gICAgcmV0dXJuIG5ldyBULkNvbnRpbnVlU3RhdGVtZW50KHtcbiAgICAgIGxhYmVsLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RTd2l0Y2hTdGF0ZW1lbnQoKSB7XG4gICAgdGhpcy5tYXRjaEtleXdvcmQoJ3N3aXRjaCcpO1xuICAgIGxldCBjb25kID0gdGhpcy5tYXRjaFBhcmVucygpO1xuICAgIGxldCBlbmYgPSBuZXcgRW5mb3Jlc3Rlcihjb25kLCBMaXN0KCksIHRoaXMuY29udGV4dCk7XG4gICAgbGV0IGRpc2NyaW1pbmFudCA9IGVuZi5lbmZvcmVzdEV4cHJlc3Npb24oKTtcbiAgICBsZXQgYm9keSA9IHRoaXMubWF0Y2hDdXJsaWVzKCk7XG5cbiAgICBpZiAoYm9keS5zaXplID09PSAwKSB7XG4gICAgICByZXR1cm4gbmV3IFQuU3dpdGNoU3RhdGVtZW50KHtcbiAgICAgICAgZGlzY3JpbWluYW50OiBkaXNjcmltaW5hbnQsXG4gICAgICAgIGNhc2VzOiBMaXN0KCksXG4gICAgICB9KTtcbiAgICB9XG4gICAgZW5mID0gbmV3IEVuZm9yZXN0ZXIoYm9keSwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuICAgIGxldCBjYXNlcyA9IGVuZi5lbmZvcmVzdFN3aXRjaENhc2VzKCk7XG4gICAgbGV0IGxvb2thaGVhZCA9IGVuZi5wZWVrKCk7XG4gICAgaWYgKGVuZi5pc0tleXdvcmQobG9va2FoZWFkLCAnZGVmYXVsdCcpKSB7XG4gICAgICBsZXQgZGVmYXVsdENhc2UgPSBlbmYuZW5mb3Jlc3RTd2l0Y2hEZWZhdWx0KCk7XG4gICAgICBsZXQgcG9zdERlZmF1bHRDYXNlcyA9IGVuZi5lbmZvcmVzdFN3aXRjaENhc2VzKCk7XG4gICAgICByZXR1cm4gbmV3IFQuU3dpdGNoU3RhdGVtZW50V2l0aERlZmF1bHQoe1xuICAgICAgICBkaXNjcmltaW5hbnQsXG4gICAgICAgIHByZURlZmF1bHRDYXNlczogY2FzZXMsXG4gICAgICAgIGRlZmF1bHRDYXNlLFxuICAgICAgICBwb3N0RGVmYXVsdENhc2VzLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgVC5Td2l0Y2hTdGF0ZW1lbnQoe1xuICAgICAgZGlzY3JpbWluYW50LFxuICAgICAgY2FzZXMsXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmVzdFN3aXRjaENhc2VzKCkge1xuICAgIGxldCBjYXNlcyA9IFtdO1xuICAgIHdoaWxlICghKHRoaXMucmVzdC5zaXplID09PSAwIHx8IHRoaXMuaXNLZXl3b3JkKHRoaXMucGVlaygpLCAnZGVmYXVsdCcpKSkge1xuICAgICAgY2FzZXMucHVzaCh0aGlzLmVuZm9yZXN0U3dpdGNoQ2FzZSgpKTtcbiAgICB9XG4gICAgcmV0dXJuIExpc3QoY2FzZXMpO1xuICB9XG5cbiAgZW5mb3Jlc3RTd2l0Y2hDYXNlKCkge1xuICAgIHRoaXMubWF0Y2hLZXl3b3JkKCdjYXNlJyk7XG4gICAgcmV0dXJuIG5ldyBULlN3aXRjaENhc2Uoe1xuICAgICAgdGVzdDogdGhpcy5lbmZvcmVzdEV4cHJlc3Npb24oKSxcbiAgICAgIGNvbnNlcXVlbnQ6IHRoaXMuZW5mb3Jlc3RTd2l0Y2hDYXNlQm9keSgpLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RTd2l0Y2hDYXNlQm9keSgpIHtcbiAgICB0aGlzLm1hdGNoUHVuY3R1YXRvcignOicpO1xuICAgIHJldHVybiB0aGlzLmVuZm9yZXN0U3RhdGVtZW50TGlzdEluU3dpdGNoQ2FzZUJvZHkoKTtcbiAgfVxuXG4gIGVuZm9yZXN0U3RhdGVtZW50TGlzdEluU3dpdGNoQ2FzZUJvZHkoKSB7XG4gICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgIHdoaWxlIChcbiAgICAgICEoXG4gICAgICAgIHRoaXMucmVzdC5zaXplID09PSAwIHx8XG4gICAgICAgIHRoaXMuaXNLZXl3b3JkKHRoaXMucGVlaygpLCAnZGVmYXVsdCcpIHx8XG4gICAgICAgIHRoaXMuaXNLZXl3b3JkKHRoaXMucGVlaygpLCAnY2FzZScpXG4gICAgICApXG4gICAgKSB7XG4gICAgICByZXN1bHQucHVzaCh0aGlzLmVuZm9yZXN0U3RhdGVtZW50TGlzdEl0ZW0oKSk7XG4gICAgfVxuICAgIHJldHVybiBMaXN0KHJlc3VsdCk7XG4gIH1cblxuICBlbmZvcmVzdFN3aXRjaERlZmF1bHQoKSB7XG4gICAgdGhpcy5tYXRjaEtleXdvcmQoJ2RlZmF1bHQnKTtcbiAgICByZXR1cm4gbmV3IFQuU3dpdGNoRGVmYXVsdCh7XG4gICAgICBjb25zZXF1ZW50OiB0aGlzLmVuZm9yZXN0U3dpdGNoQ2FzZUJvZHkoKSxcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yZXN0Rm9yU3RhdGVtZW50KCkge1xuICAgIHRoaXMubWF0Y2hLZXl3b3JkKCdmb3InKTtcbiAgICBsZXQgY29uZCA9IHRoaXMubWF0Y2hQYXJlbnMoKTtcbiAgICBsZXQgZW5mID0gbmV3IEVuZm9yZXN0ZXIoY29uZCwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuICAgIGxldCBsb29rYWhlYWQsIHRlc3QsIGluaXQsIHJpZ2h0LCBsZWZ0LCB1cGRhdGUsIGNuc3Q7XG5cbiAgICAvLyBjYXNlIHdoZXJlIGluaXQgaXMgbnVsbFxuICAgIGlmIChlbmYuaXNQdW5jdHVhdG9yKGVuZi5wZWVrKCksICc7JykpIHtcbiAgICAgIGVuZi5hZHZhbmNlKCk7XG4gICAgICBpZiAoIWVuZi5pc1B1bmN0dWF0b3IoZW5mLnBlZWsoKSwgJzsnKSkge1xuICAgICAgICB0ZXN0ID0gZW5mLmVuZm9yZXN0RXhwcmVzc2lvbigpO1xuICAgICAgfVxuICAgICAgZW5mLm1hdGNoUHVuY3R1YXRvcignOycpO1xuICAgICAgaWYgKGVuZi5yZXN0LnNpemUgIT09IDApIHtcbiAgICAgICAgcmlnaHQgPSBlbmYuZW5mb3Jlc3RFeHByZXNzaW9uKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IFQuRm9yU3RhdGVtZW50KHtcbiAgICAgICAgaW5pdDogbnVsbCxcbiAgICAgICAgdGVzdDogdGVzdCxcbiAgICAgICAgdXBkYXRlOiByaWdodCxcbiAgICAgICAgYm9keTogdGhpcy5lbmZvcmVzdFN0YXRlbWVudCgpLFxuICAgICAgfSk7XG4gICAgICAvLyBjYXNlIHdoZXJlIGluaXQgaXMgbm90IG51bGxcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdGVzdGluZ1xuICAgICAgbG9va2FoZWFkID0gZW5mLnBlZWsoKTtcbiAgICAgIGlmIChcbiAgICAgICAgZW5mLmlzVmFyRGVjbFRyYW5zZm9ybShsb29rYWhlYWQpIHx8XG4gICAgICAgIGVuZi5pc0xldERlY2xUcmFuc2Zvcm0obG9va2FoZWFkKSB8fFxuICAgICAgICBlbmYuaXNDb25zdERlY2xUcmFuc2Zvcm0obG9va2FoZWFkKVxuICAgICAgKSB7XG4gICAgICAgIGluaXQgPSBlbmYuZW5mb3Jlc3RWYXJpYWJsZURlY2xhcmF0aW9uKCk7XG4gICAgICAgIGxvb2thaGVhZCA9IGVuZi5wZWVrKCk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0aGlzLmlzS2V5d29yZChsb29rYWhlYWQsICdpbicpIHx8XG4gICAgICAgICAgdGhpcy5pc0lkZW50aWZpZXIobG9va2FoZWFkLCAnb2YnKVxuICAgICAgICApIHtcbiAgICAgICAgICBpZiAodGhpcy5pc0tleXdvcmQobG9va2FoZWFkLCAnaW4nKSkge1xuICAgICAgICAgICAgZW5mLmFkdmFuY2UoKTtcbiAgICAgICAgICAgIHJpZ2h0ID0gZW5mLmVuZm9yZXN0RXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgY25zdCA9IFQuRm9ySW5TdGF0ZW1lbnQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFzc2VydChcbiAgICAgICAgICAgICAgdGhpcy5pc0lkZW50aWZpZXIobG9va2FoZWFkLCAnb2YnKSxcbiAgICAgICAgICAgICAgJ2V4cGVjdGluZyBgb2ZgIGtleXdvcmQnLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGVuZi5hZHZhbmNlKCk7XG4gICAgICAgICAgICByaWdodCA9IGVuZi5lbmZvcmVzdEV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgIGNuc3QgPSBULkZvck9mU3RhdGVtZW50O1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbmV3IGNuc3Qoe1xuICAgICAgICAgICAgbGVmdDogaW5pdCxcbiAgICAgICAgICAgIHJpZ2h0LFxuICAgICAgICAgICAgYm9keTogdGhpcy5lbmZvcmVzdFN0YXRlbWVudCgpLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVuZi5tYXRjaFB1bmN0dWF0b3IoJzsnKTtcbiAgICAgICAgaWYgKGVuZi5pc1B1bmN0dWF0b3IoZW5mLnBlZWsoKSwgJzsnKSkge1xuICAgICAgICAgIGVuZi5hZHZhbmNlKCk7XG4gICAgICAgICAgdGVzdCA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGVzdCA9IGVuZi5lbmZvcmVzdEV4cHJlc3Npb24oKTtcbiAgICAgICAgICBlbmYubWF0Y2hQdW5jdHVhdG9yKCc7Jyk7XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlID0gZW5mLmVuZm9yZXN0RXhwcmVzc2lvbigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHRoaXMuaXNLZXl3b3JkKGVuZi5wZWVrKDEpLCAnaW4nKSB8fFxuICAgICAgICAgIHRoaXMuaXNJZGVudGlmaWVyKGVuZi5wZWVrKDEpLCAnb2YnKVxuICAgICAgICApIHtcbiAgICAgICAgICBsZWZ0ID0gZW5mLmVuZm9yZXN0QmluZGluZ0lkZW50aWZpZXIoKTtcbiAgICAgICAgICBsZXQga2luZCA9IGVuZi5hZHZhbmNlKCk7XG4gICAgICAgICAgaWYgKHRoaXMuaXNLZXl3b3JkKGtpbmQsICdpbicpKSB7XG4gICAgICAgICAgICBjbnN0ID0gVC5Gb3JJblN0YXRlbWVudDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGVmdCA9IHRoaXMudHJhbnNmb3JtRGVzdHJ1Y3R1cmluZyhsZWZ0KTtcbiAgICAgICAgICAgIGNuc3QgPSBULkZvck9mU3RhdGVtZW50O1xuICAgICAgICAgIH1cbiAgICAgICAgICByaWdodCA9IGVuZi5lbmZvcmVzdEV4cHJlc3Npb24oKTtcbiAgICAgICAgICByZXR1cm4gbmV3IGNuc3Qoe1xuICAgICAgICAgICAgbGVmdDogbGVmdCxcbiAgICAgICAgICAgIHJpZ2h0LFxuICAgICAgICAgICAgYm9keTogdGhpcy5lbmZvcmVzdFN0YXRlbWVudCgpLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGluaXQgPSBlbmYuZW5mb3Jlc3RFeHByZXNzaW9uKCk7XG4gICAgICAgIGVuZi5tYXRjaFB1bmN0dWF0b3IoJzsnKTtcbiAgICAgICAgaWYgKGVuZi5pc1B1bmN0dWF0b3IoZW5mLnBlZWsoKSwgJzsnKSkge1xuICAgICAgICAgIGVuZi5hZHZhbmNlKCk7XG4gICAgICAgICAgdGVzdCA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGVzdCA9IGVuZi5lbmZvcmVzdEV4cHJlc3Npb24oKTtcbiAgICAgICAgICBlbmYubWF0Y2hQdW5jdHVhdG9yKCc7Jyk7XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlID0gZW5mLmVuZm9yZXN0RXhwcmVzc2lvbigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBULkZvclN0YXRlbWVudCh7XG4gICAgICAgIGluaXQsXG4gICAgICAgIHRlc3QsXG4gICAgICAgIHVwZGF0ZSxcbiAgICAgICAgYm9keTogdGhpcy5lbmZvcmVzdFN0YXRlbWVudCgpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZW5mb3Jlc3RJZlN0YXRlbWVudCgpIHtcbiAgICB0aGlzLm1hdGNoS2V5d29yZCgnaWYnKTtcbiAgICBsZXQgY29uZCA9IHRoaXMubWF0Y2hQYXJlbnMoKTtcbiAgICBsZXQgZW5mID0gbmV3IEVuZm9yZXN0ZXIoY29uZCwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuICAgIGxldCBsb29rYWhlYWQgPSBlbmYucGVlaygpO1xuICAgIGxldCB0ZXN0ID0gZW5mLmVuZm9yZXN0RXhwcmVzc2lvbigpO1xuICAgIGlmICh0ZXN0ID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBlbmYuY3JlYXRlRXJyb3IobG9va2FoZWFkLCAnZXhwZWN0aW5nIGFuIGV4cHJlc3Npb24nKTtcbiAgICB9XG4gICAgbGV0IGNvbnNlcXVlbnQgPSB0aGlzLmVuZm9yZXN0U3RhdGVtZW50KCk7XG4gICAgbGV0IGFsdGVybmF0ZSA9IG51bGw7XG4gICAgaWYgKHRoaXMuaXNLZXl3b3JkKHRoaXMucGVlaygpLCAnZWxzZScpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIGFsdGVybmF0ZSA9IHRoaXMuZW5mb3Jlc3RTdGF0ZW1lbnQoKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBULklmU3RhdGVtZW50KHtcbiAgICAgIHRlc3QsXG4gICAgICBjb25zZXF1ZW50LFxuICAgICAgYWx0ZXJuYXRlLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RXaGlsZVN0YXRlbWVudCgpIHtcbiAgICB0aGlzLm1hdGNoS2V5d29yZCgnd2hpbGUnKTtcbiAgICBsZXQgY29uZCA9IHRoaXMubWF0Y2hQYXJlbnMoKTtcbiAgICBsZXQgZW5mID0gbmV3IEVuZm9yZXN0ZXIoY29uZCwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuICAgIGxldCBsb29rYWhlYWQgPSBlbmYucGVlaygpO1xuICAgIGxldCB0ZXN0ID0gZW5mLmVuZm9yZXN0RXhwcmVzc2lvbigpO1xuICAgIGlmICh0ZXN0ID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBlbmYuY3JlYXRlRXJyb3IobG9va2FoZWFkLCAnZXhwZWN0aW5nIGFuIGV4cHJlc3Npb24nKTtcbiAgICB9XG4gICAgbGV0IGJvZHkgPSB0aGlzLmVuZm9yZXN0U3RhdGVtZW50KCk7XG5cbiAgICByZXR1cm4gbmV3IFQuV2hpbGVTdGF0ZW1lbnQoe1xuICAgICAgdGVzdCxcbiAgICAgIGJvZHksXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmVzdEJsb2NrU3RhdGVtZW50KCkge1xuICAgIHJldHVybiBuZXcgVC5CbG9ja1N0YXRlbWVudCh7XG4gICAgICBibG9jazogdGhpcy5lbmZvcmVzdEJsb2NrKCksXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmVzdEJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgVC5CbG9jayh7XG4gICAgICBzdGF0ZW1lbnRzOiB0aGlzLm1hdGNoQ3VybGllcygpLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RDbGFzcyh7XG4gICAgaXNFeHByID0gZmFsc2UsXG4gICAgaW5EZWZhdWx0ID0gZmFsc2UsXG4gIH06IHtcbiAgICBpc0V4cHI/OiBib29sZWFuLFxuICAgIGluRGVmYXVsdD86IGJvb2xlYW4sXG4gIH0pIHtcbiAgICBsZXQga3cgPSB0aGlzLm1hdGNoUmF3U3ludGF4KCk7XG4gICAgbGV0IG5hbWUgPSBudWxsLFxuICAgICAgc3VwciA9IG51bGw7XG5cbiAgICBpZiAodGhpcy5pc0lkZW50aWZpZXIodGhpcy5wZWVrKCkpKSB7XG4gICAgICBuYW1lID0gdGhpcy5lbmZvcmVzdEJpbmRpbmdJZGVudGlmaWVyKCk7XG4gICAgfSBlbHNlIGlmICghaXNFeHByKSB7XG4gICAgICBpZiAoaW5EZWZhdWx0KSB7XG4gICAgICAgIG5hbWUgPSBuZXcgVC5CaW5kaW5nSWRlbnRpZmllcih7XG4gICAgICAgICAgbmFtZTogU3ludGF4LmZyb21JZGVudGlmaWVyKCdfZGVmYXVsdCcsIGt3KSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKHRoaXMucGVlaygpLCAndW5leHBlY3RlZCBzeW50YXgnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc0tleXdvcmQodGhpcy5wZWVrKCksICdleHRlbmRzJykpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgc3VwciA9IHRoaXMuZW5mb3Jlc3RFeHByZXNzaW9uTG9vcCgpO1xuICAgIH1cblxuICAgIGxldCBlbGVtZW50cyA9IFtdO1xuICAgIGxldCBlbmYgPSBuZXcgRW5mb3Jlc3Rlcih0aGlzLm1hdGNoQ3VybGllcygpLCBMaXN0KCksIHRoaXMuY29udGV4dCk7XG4gICAgd2hpbGUgKGVuZi5yZXN0LnNpemUgIT09IDApIHtcbiAgICAgIGlmIChlbmYuaXNQdW5jdHVhdG9yKGVuZi5wZWVrKCksICc7JykpIHtcbiAgICAgICAgZW5mLmFkdmFuY2UoKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGxldCBpc1N0YXRpYyA9IGZhbHNlO1xuICAgICAgbGV0IHsgbWV0aG9kT3JLZXksIGtpbmQgfSA9IGVuZi5lbmZvcmVzdE1ldGhvZERlZmluaXRpb24oKTtcbiAgICAgIGlmIChcbiAgICAgICAga2luZCA9PT0gJ2lkZW50aWZpZXInICYmXG4gICAgICAgIG1ldGhvZE9yS2V5IGluc3RhbmNlb2YgVC5TdGF0aWNQcm9wZXJ0eU5hbWUgJiZcbiAgICAgICAgbWV0aG9kT3JLZXkudmFsdWUudmFsKCkgPT09ICdzdGF0aWMnXG4gICAgICApIHtcbiAgICAgICAgaXNTdGF0aWMgPSB0cnVlO1xuICAgICAgICAoeyBtZXRob2RPcktleSwga2luZCB9ID0gZW5mLmVuZm9yZXN0TWV0aG9kRGVmaW5pdGlvbigpKTtcbiAgICAgIH1cbiAgICAgIGlmIChraW5kID09PSAnbWV0aG9kJykge1xuICAgICAgICBlbGVtZW50cy5wdXNoKFxuICAgICAgICAgIG5ldyBULkNsYXNzRWxlbWVudCh7XG4gICAgICAgICAgICBpc1N0YXRpYyxcbiAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kT3JLZXksXG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKFxuICAgICAgICAgIGVuZi5wZWVrKCksXG4gICAgICAgICAgJ09ubHkgbWV0aG9kcyBhcmUgYWxsb3dlZCBpbiBjbGFzc2VzJyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyAoaXNFeHByID8gVC5DbGFzc0V4cHJlc3Npb24gOiBULkNsYXNzRGVjbGFyYXRpb24pKHtcbiAgICAgIG5hbWUsXG4gICAgICBzdXBlcjogc3VwcixcbiAgICAgIGVsZW1lbnRzOiBMaXN0KGVsZW1lbnRzKSxcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yZXN0QmluZGluZ1RhcmdldChcbiAgICB7XG4gICAgICBhbGxvd1B1bmN0dWF0b3IgPSBmYWxzZSxcbiAgICB9OiB7XG4gICAgICBhbGxvd1B1bmN0dWF0b3I/OiBib29sZWFuLFxuICAgIH0gPSB7fSxcbiAgKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgIGlmIChcbiAgICAgIHRoaXMuaXNJZGVudGlmaWVyKGxvb2thaGVhZCkgfHxcbiAgICAgIHRoaXMuaXNLZXl3b3JkKGxvb2thaGVhZCkgfHxcbiAgICAgIChhbGxvd1B1bmN0dWF0b3IgJiYgdGhpcy5pc1B1bmN0dWF0b3IobG9va2FoZWFkKSlcbiAgICApIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0QmluZGluZ0lkZW50aWZpZXIoe1xuICAgICAgICBhbGxvd1B1bmN0dWF0b3IsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuaXNCcmFja2V0cyhsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdEFycmF5QmluZGluZygpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc0JyYWNlcyhsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdE9iamVjdEJpbmRpbmcoKTtcbiAgICB9XG4gICAgYXNzZXJ0KGZhbHNlLCAnbm90IGltcGxlbWVudGVkIHlldCcpO1xuICB9XG5cbiAgZW5mb3Jlc3RPYmplY3RCaW5kaW5nKCkge1xuICAgIGxldCBlbmYgPSBuZXcgRW5mb3Jlc3Rlcih0aGlzLm1hdGNoQ3VybGllcygpLCBMaXN0KCksIHRoaXMuY29udGV4dCk7XG4gICAgbGV0IHByb3BlcnRpZXMgPSBbXTtcblxuICAgIC8vVE9ETzogaW1wbGVtZW50IG9iamVjdCByZXN0IG9wZXJhdG9yIHdoZW4gaXQgbGFuZHNcbiAgICB3aGlsZSAoZW5mLnJlc3Quc2l6ZSAhPT0gMCkge1xuICAgICAgcHJvcGVydGllcy5wdXNoKGVuZi5lbmZvcmVzdEJpbmRpbmdQcm9wZXJ0eSgpKTtcblxuICAgICAgaWYgKGVuZi5yZXN0LnNpemUgPiAwICYmICFlbmYuaXNQdW5jdHVhdG9yKGVuZi5wZWVrKCksICcsJykpIHtcbiAgICAgICAgdGhyb3cgZW5mLmNyZWF0ZUVycm9yKGVuZi5wZWVrKCksICd1bmV4cGVjdGVkIHRva2VuJyk7XG4gICAgICB9XG5cbiAgICAgIGVuZi5jb25zdW1lQ29tbWEoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFQuT2JqZWN0QmluZGluZyh7XG4gICAgICBwcm9wZXJ0aWVzOiBMaXN0KHByb3BlcnRpZXMpLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RCaW5kaW5nUHJvcGVydHkoKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgIGxldCB7IG5hbWUsIGJpbmRpbmcgfSA9IHRoaXMuZW5mb3Jlc3RQcm9wZXJ0eU5hbWUoKTtcbiAgICBpZiAoXG4gICAgICB0aGlzLmlzSWRlbnRpZmllcihsb29rYWhlYWQpIHx8XG4gICAgICB0aGlzLmlzS2V5d29yZChsb29rYWhlYWQsICdsZXQnKSB8fFxuICAgICAgdGhpcy5pc0tleXdvcmQobG9va2FoZWFkLCAneWllbGQnKVxuICAgICkge1xuICAgICAgaWYgKCF0aGlzLmlzUHVuY3R1YXRvcih0aGlzLnBlZWsoKSwgJzonKSkge1xuICAgICAgICBpZiAodGhpcy5pc0Fzc2lnbih0aGlzLnBlZWsoKSkpIHtcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBsZXQgZXhwciA9IHRoaXMuZW5mb3Jlc3RFeHByZXNzaW9uTG9vcCgpO1xuICAgICAgICAgIHJldHVybiBuZXcgVC5CaW5kaW5nUHJvcGVydHlQcm9wZXJ0eSh7XG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgYmluZGluZzogbmV3IFQuQmluZGluZ1dpdGhEZWZhdWx0KHtcbiAgICAgICAgICAgICAgYmluZGluZyxcbiAgICAgICAgICAgICAgaW5pdDogZXhwcixcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgVC5CaW5kaW5nUHJvcGVydHlQcm9wZXJ0eSh7XG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICBiaW5kaW5nLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5tYXRjaFB1bmN0dWF0b3IoJzonKTtcbiAgICBiaW5kaW5nID0gdGhpcy5lbmZvcmVzdEJpbmRpbmdFbGVtZW50KCk7XG4gICAgcmV0dXJuIG5ldyBULkJpbmRpbmdQcm9wZXJ0eVByb3BlcnR5KHtcbiAgICAgIG5hbWUsXG4gICAgICBiaW5kaW5nLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RBcnJheUJpbmRpbmcoKSB7XG4gICAgbGV0IGJyYWNrZXQgPSB0aGlzLm1hdGNoU3F1YXJlcygpO1xuICAgIGxldCBlbmYgPSBuZXcgRW5mb3Jlc3RlcihicmFja2V0LCBMaXN0KCksIHRoaXMuY29udGV4dCk7XG4gICAgbGV0IGVsZW1lbnRzID0gW10sXG4gICAgICByZXN0ID0gbnVsbDtcbiAgICB3aGlsZSAoZW5mLnJlc3Quc2l6ZSAhPT0gMCkge1xuICAgICAgbGV0IGVsID0gbnVsbDtcbiAgICAgIGlmICghZW5mLmlzUHVuY3R1YXRvcihlbmYucGVlaygpLCAnLCcpKSB7XG4gICAgICAgIGlmIChlbmYuaXNQdW5jdHVhdG9yKGVuZi5wZWVrKCksICcuLi4nKSkge1xuICAgICAgICAgIGVuZi5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdCA9IGVuZi5lbmZvcmVzdEJpbmRpbmdUYXJnZXQoKTtcbiAgICAgICAgICBpZiAoZW5mLnJlc3Quc2l6ZSA+IDApIHtcbiAgICAgICAgICAgIHRocm93IGVuZi5jcmVhdGVFcnJvcihcbiAgICAgICAgICAgICAgZW5mLnJlc3QuZmlyc3QoKSxcbiAgICAgICAgICAgICAgJ1Jlc3QgZWxlbWVudCBtdXN0IGJlIGxhc3QgZWxlbWVudCBpbiBhcnJheScsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbCA9IGVuZi5lbmZvcmVzdEJpbmRpbmdFbGVtZW50KCk7XG5cbiAgICAgICAgICBpZiAoZWwgPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgZW5mLmNyZWF0ZUVycm9yKGVuZi5wZWVrKCksICdleHBlY3RlZCBleHByZXNzaW9uJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChlbmYucmVzdC5zaXplID4gMCAmJiAhZW5mLmlzUHVuY3R1YXRvcihlbmYucGVlaygpLCAnLCcpKSB7XG4gICAgICAgICAgICB0aHJvdyBlbmYuY3JlYXRlRXJyb3IoZW5mLnBlZWsoKSwgJ3VuZXhwZWN0ZWQgdG9rZW4nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyZXN0ID09IG51bGwpIHtcbiAgICAgICAgZWxlbWVudHMucHVzaChlbCk7XG4gICAgICAgIGVuZi5jb25zdW1lQ29tbWEoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBULkFycmF5QmluZGluZyh7XG4gICAgICBlbGVtZW50czogTGlzdChlbGVtZW50cyksXG4gICAgICByZXN0LFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RCaW5kaW5nRWxlbWVudCgpIHtcbiAgICBsZXQgYmluZGluZyA9IHRoaXMuZW5mb3Jlc3RCaW5kaW5nVGFyZ2V0KCk7XG5cbiAgICBpZiAodGhpcy5pc0Fzc2lnbih0aGlzLnBlZWsoKSkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgbGV0IGluaXQgPSB0aGlzLmVuZm9yZXN0RXhwcmVzc2lvbkxvb3AoKTtcbiAgICAgIGJpbmRpbmcgPSBuZXcgVC5CaW5kaW5nV2l0aERlZmF1bHQoe1xuICAgICAgICBiaW5kaW5nLFxuICAgICAgICBpbml0LFxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5nO1xuICB9XG5cbiAgZW5mb3Jlc3RCaW5kaW5nSWRlbnRpZmllcihcbiAgICB7XG4gICAgICBhbGxvd1B1bmN0dWF0b3IsXG4gICAgfToge1xuICAgICAgYWxsb3dQdW5jdHVhdG9yPzogYm9vbGVhbixcbiAgICB9ID0ge30sXG4gICkge1xuICAgIGxldCBuYW1lO1xuICAgIGlmIChhbGxvd1B1bmN0dWF0b3IgJiYgdGhpcy5pc1B1bmN0dWF0b3IodGhpcy5wZWVrKCkpKSB7XG4gICAgICBuYW1lID0gdGhpcy5lbmZvcmVzdFB1bmN0dWF0b3IoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZSA9IHRoaXMuZW5mb3Jlc3RJZGVudGlmaWVyKCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgVC5CaW5kaW5nSWRlbnRpZmllcih7XG4gICAgICBuYW1lLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RQdW5jdHVhdG9yKCkge1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICBpZiAodGhpcy5pc1B1bmN0dWF0b3IobG9va2FoZWFkKSkge1xuICAgICAgcmV0dXJuIHRoaXMubWF0Y2hSYXdTeW50YXgoKTtcbiAgICB9XG4gICAgdGhyb3cgdGhpcy5jcmVhdGVFcnJvcihsb29rYWhlYWQsICdleHBlY3RpbmcgYSBwdW5jdHVhdG9yJyk7XG4gIH1cblxuICBlbmZvcmVzdElkZW50aWZpZXIoKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgIGlmICh0aGlzLmlzSWRlbnRpZmllcihsb29rYWhlYWQpIHx8IHRoaXMuaXNLZXl3b3JkKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLm1hdGNoUmF3U3ludGF4KCk7XG4gICAgfVxuICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IobG9va2FoZWFkLCAnZXhwZWN0aW5nIGFuIGlkZW50aWZpZXInKTtcbiAgfVxuXG4gIGVuZm9yZXN0UmV0dXJuU3RhdGVtZW50KCkge1xuICAgIGxldCBrdyA9IHRoaXMubWF0Y2hSYXdTeW50YXgoKTtcbiAgICBsZXQgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG5cbiAgICAvLyBzaG9ydCBjaXJjdWl0IGZvciB0aGUgZW1wdHkgZXhwcmVzc2lvbiBjYXNlXG4gICAgaWYgKFxuICAgICAgdGhpcy5yZXN0LnNpemUgPT09IDAgfHxcbiAgICAgIChsb29rYWhlYWQgJiYgIXRoaXMubGluZU51bWJlckVxKGt3LCBsb29rYWhlYWQpKVxuICAgICkge1xuICAgICAgcmV0dXJuIG5ldyBULlJldHVyblN0YXRlbWVudCh7XG4gICAgICAgIGV4cHJlc3Npb246IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBsZXQgdGVybSA9IG51bGw7XG4gICAgaWYgKCF0aGlzLmlzUHVuY3R1YXRvcihsb29rYWhlYWQsICc7JykpIHtcbiAgICAgIHRlcm0gPSB0aGlzLmVuZm9yZXN0RXhwcmVzc2lvbigpO1xuICAgICAgZXhwZWN0KFxuICAgICAgICB0ZXJtICE9IG51bGwsXG4gICAgICAgICdFeHBlY3RpbmcgYW4gZXhwcmVzc2lvbiB0byBmb2xsb3cgcmV0dXJuIGtleXdvcmQnLFxuICAgICAgICBsb29rYWhlYWQsXG4gICAgICAgIHRoaXMucmVzdCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhpcy5jb25zdW1lU2VtaWNvbG9uKCk7XG4gICAgcmV0dXJuIG5ldyBULlJldHVyblN0YXRlbWVudCh7XG4gICAgICBleHByZXNzaW9uOiB0ZXJtLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RWYXJpYWJsZURlY2xhcmF0aW9uKCkge1xuICAgIGxldCBraW5kO1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLmFkdmFuY2UoKTtcblxuICAgIGlmICh0aGlzLmlzVmFyRGVjbFRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICBraW5kID0gJ3Zhcic7XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzTGV0RGVjbFRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICBraW5kID0gJ2xldCc7XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzQ29uc3REZWNsVHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIGtpbmQgPSAnY29uc3QnO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc1N5bnRheERlY2xUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAga2luZCA9ICdzeW50YXgnO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc1N5bnRheHJlY0RlY2xUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAga2luZCA9ICdzeW50YXhyZWMnO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc09wZXJhdG9yRGVjbFRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICBraW5kID0gJ29wZXJhdG9yJztcbiAgICB9XG5cbiAgICBsZXQgZGVjbHMgPSBMaXN0KCk7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgbGV0IHRlcm0gPSB0aGlzLmVuZm9yZXN0VmFyaWFibGVEZWNsYXJhdG9yKHtcbiAgICAgICAgaXNTeW50YXg6XG4gICAgICAgICAga2luZCA9PT0gJ3N5bnRheCcgfHwga2luZCA9PT0gJ3N5bnRheHJlYycgfHwga2luZCA9PT0gJ29wZXJhdG9yJyxcbiAgICAgICAgaXNPcGVyYXRvcjoga2luZCA9PT0gJ29wZXJhdG9yJyxcbiAgICAgIH0pO1xuICAgICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgICAgLy8gVE9ETzogYnVnIGluIGltbXV0YWJsZSB0eXBlIGRlZmluaXRpb25zIGZvciBjb25jYXQsXG4gICAgICAvLyB1cGdyYWRlIHRvIHY0IHdoZW4gaXQgaXMgcmVsZWFzZWRcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9pbW11dGFibGUtanMvcHVsbC8xMTUzXG4gICAgICBkZWNscyA9IGRlY2xzLmNvbmNhdCgodGVybTogYW55KSk7XG5cbiAgICAgIGlmICh0aGlzLmlzUHVuY3R1YXRvcihsb29rYWhlYWQsICcsJykpIHtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFQuVmFyaWFibGVEZWNsYXJhdGlvbih7XG4gICAgICBraW5kOiBraW5kLFxuICAgICAgZGVjbGFyYXRvcnM6IGRlY2xzLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RWYXJpYWJsZURlY2xhcmF0b3Ioe1xuICAgIGlzU3ludGF4LFxuICAgIGlzT3BlcmF0b3IsXG4gIH06IHtcbiAgICBpc1N5bnRheDogYm9vbGVhbixcbiAgICBpc09wZXJhdG9yOiBib29sZWFuLFxuICB9KSB7XG4gICAgbGV0IGlkID0gdGhpcy5lbmZvcmVzdEJpbmRpbmdUYXJnZXQoe1xuICAgICAgYWxsb3dQdW5jdHVhdG9yOiBpc1N5bnRheCxcbiAgICB9KTtcbiAgICBjb25zdCBBc3NvY1ZhbHVlcyA9IFsnbGVmdCcsICdyaWdodCcsICdwcmVmaXgnLCAncG9zdGZpeCddO1xuXG4gICAgbGV0IGFzc29jLCBwcmVjO1xuICAgIGlmIChpc09wZXJhdG9yKSB7XG4gICAgICBhc3NvYyA9IHRoaXMubWF0Y2hJZGVudGlmaWVyKCk7XG4gICAgICBpZiAoQXNzb2NWYWx1ZXMuaW5kZXhPZihhc3NvYy52YWwoKSkgPT09IC0xKSB7XG4gICAgICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IoXG4gICAgICAgICAgdGhpcy5wZWVrKCksXG4gICAgICAgICAgYEFzc29jaWF0aXZpdHkgbXVzdCBiZSBvbmUgb2YgJHtBc3NvY1ZhbHVlcy5qb2luKCcsJyl9YCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHByZWMgPSB0aGlzLm1hdGNoTGl0ZXJhbCgpO1xuICAgIH1cblxuICAgIGxldCBpbml0O1xuICAgIGlmICh0aGlzLmlzUHVuY3R1YXRvcih0aGlzLnBlZWsoKSwgJz0nKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICBsZXQgZW5mID0gbmV3IEVuZm9yZXN0ZXIodGhpcy5yZXN0LCBMaXN0KCksIHRoaXMuY29udGV4dCk7XG4gICAgICBpbml0ID0gZW5mLmVuZm9yZXN0KCdleHByZXNzaW9uJyk7XG4gICAgICB0aGlzLnJlc3QgPSBlbmYucmVzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5pdCA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGlzT3BlcmF0b3IpIHtcbiAgICAgIHJldHVybiBuZXcgVC5PcGVyYXRvckRlY2xhcmF0b3Ioe1xuICAgICAgICBiaW5kaW5nOiBpZCxcbiAgICAgICAgaW5pdCxcbiAgICAgICAgcHJlYyxcbiAgICAgICAgYXNzb2MsXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBULlZhcmlhYmxlRGVjbGFyYXRvcih7XG4gICAgICBiaW5kaW5nOiBpZCxcbiAgICAgIGluaXQ6IGluaXQsXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmVzdEV4cHJlc3Npb25TdGF0ZW1lbnQoKSB7XG4gICAgbGV0IHN0YXJ0ID0gdGhpcy5yZXN0LmdldCgwKTtcbiAgICBsZXQgZXhwciA9IHRoaXMuZW5mb3Jlc3RFeHByZXNzaW9uKCk7XG4gICAgaWYgKGV4cHIgPT09IG51bGwpIHtcbiAgICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3Ioc3RhcnQsICdub3QgYSB2YWxpZCBleHByZXNzaW9uJyk7XG4gICAgfVxuICAgIHRoaXMuY29uc3VtZVNlbWljb2xvbigpO1xuXG4gICAgcmV0dXJuIG5ldyBULkV4cHJlc3Npb25TdGF0ZW1lbnQoe1xuICAgICAgZXhwcmVzc2lvbjogZXhwcixcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yZXN0RXhwcmVzc2lvbigpIHtcbiAgICBsZXQgbGVmdCA9IHRoaXMuZW5mb3Jlc3RFeHByZXNzaW9uTG9vcCgpO1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICBpZiAodGhpcy5pc1B1bmN0dWF0b3IobG9va2FoZWFkLCAnLCcpKSB7XG4gICAgICB3aGlsZSAodGhpcy5yZXN0LnNpemUgIT09IDApIHtcbiAgICAgICAgaWYgKCF0aGlzLmlzUHVuY3R1YXRvcih0aGlzLnBlZWsoKSwgJywnKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGxldCBvcGVyYXRvciA9IHRoaXMubWF0Y2hSYXdTeW50YXgoKTtcbiAgICAgICAgbGV0IHJpZ2h0ID0gdGhpcy5lbmZvcmVzdEV4cHJlc3Npb25Mb29wKCk7XG4gICAgICAgIGxlZnQgPSBuZXcgVC5CaW5hcnlFeHByZXNzaW9uKHtcbiAgICAgICAgICBsZWZ0LFxuICAgICAgICAgIG9wZXJhdG9yOiBvcGVyYXRvci52YWwoKSxcbiAgICAgICAgICByaWdodCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMudGVybSA9IG51bGw7XG4gICAgcmV0dXJuIGxlZnQ7XG4gIH1cblxuICBlbmZvcmVzdEV4cHJlc3Npb25Mb29wKCkge1xuICAgIHRoaXMudGVybSA9IG51bGw7XG4gICAgdGhpcy5vcEN0eCA9IHtcbiAgICAgIHByZWM6IDAsXG4gICAgICBjb21iaW5lOiB4ID0+IHgsXG4gICAgICBzdGFjazogTGlzdCgpLFxuICAgIH07XG5cbiAgICBkbyB7XG4gICAgICBsZXQgdGVybSA9IHRoaXMuZW5mb3Jlc3RBc3NpZ25tZW50RXhwcmVzc2lvbigpO1xuICAgICAgLy8gbm8gY2hhbmdlIG1lYW5zIHdlJ3ZlIGRvbmUgYXMgbXVjaCBlbmZvcmVzdGluZyBhcyBwb3NzaWJsZVxuICAgICAgLy8gaWYgbm90aGluZyBjaGFuZ2VkLCBtYXliZSB3ZSBqdXN0IG5lZWQgdG8gcG9wIHRoZSBleHByIHN0YWNrXG4gICAgICBpZiAodGVybSA9PT0gRVhQUl9MT09QX05PX0NIQU5HRSAmJiB0aGlzLm9wQ3R4LnN0YWNrLnNpemUgPiAwKSB7XG4gICAgICAgIHRoaXMudGVybSA9IHRoaXMub3BDdHguY29tYmluZSh0aGlzLnRlcm0pO1xuICAgICAgICBsZXQgeyBwcmVjLCBjb21iaW5lIH0gPSB0aGlzLm9wQ3R4LnN0YWNrLmxhc3QoKTtcbiAgICAgICAgdGhpcy5vcEN0eC5wcmVjID0gcHJlYztcbiAgICAgICAgdGhpcy5vcEN0eC5jb21iaW5lID0gY29tYmluZTtcbiAgICAgICAgdGhpcy5vcEN0eC5zdGFjayA9IHRoaXMub3BDdHguc3RhY2sucG9wKCk7XG4gICAgICB9IGVsc2UgaWYgKHRlcm0gPT09IEVYUFJfTE9PUF9OT19DSEFOR0UpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2UgaWYgKHRlcm0gPT09IEVYUFJfTE9PUF9PUEVSQVRPUiB8fCB0ZXJtID09PSBFWFBSX0xPT1BfRVhQQU5TSU9OKSB7XG4gICAgICAgIC8vIG9wZXJhdG9yIG1lYW5zIGFuIG9wQ3R4IHdhcyBwdXNoZWQgb24gdGhlIHN0YWNrXG4gICAgICAgIHRoaXMudGVybSA9IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnRlcm0gPSAodGVybTogYW55KTsgLy8gVE9ETzogZG9uJ3Qgb3ZlcmxvYWQgdGhlIHRlcm0ncyB0eXBlIHdpdGggRVhQUl9MT09QX09QRVJBVE9SIGV0Yy5cbiAgICAgIH1cbiAgICB9IHdoaWxlICh0cnVlKTsgLy8gZ2V0IGEgZml4cG9pbnRcbiAgICByZXR1cm4gdGhpcy50ZXJtO1xuICB9XG5cbiAgZW5mb3Jlc3RBc3NpZ25tZW50RXhwcmVzc2lvbigpIHtcbiAgICBsZXQgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG5cbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNNb2R1bGVOYW1lc3BhY2VUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAgLy8gJEZsb3dGaXhNZTogd2UgbmVlZCB0byByZWZhY3RvciB0aGUgZW5mb3Jlc3RlciB0byBtYWtlIGZsb3cgd29yayBiZXR0ZXJcbiAgICAgIGxldCBuYW1lc3BhY2UgPSB0aGlzLmdldEZyb21Db21waWxldGltZUVudmlyb25tZW50KHRoaXMuYWR2YW5jZSgpLnZhbHVlKTtcbiAgICAgIHRoaXMubWF0Y2hQdW5jdHVhdG9yKCcuJyk7XG4gICAgICBsZXQgbmFtZSA9IHRoaXMubWF0Y2hJZGVudGlmaWVyKCk7XG4gICAgICAvLyAkRmxvd0ZpeE1lOiB3ZSBuZWVkIHRvIHJlZmFjdG9yIHRoZSBlbmZvcmVzdGVyIHRvIG1ha2UgZmxvdyB3b3JrIGJldHRlclxuICAgICAgbGV0IGV4cG9ydGVkTmFtZSA9IG5hbWVzcGFjZS5tb2QuZXhwb3J0ZWROYW1lcy5maW5kKFxuICAgICAgICBleE5hbWUgPT4gZXhOYW1lLmV4cG9ydGVkTmFtZS52YWwoKSA9PT0gbmFtZS52YWwoKSxcbiAgICAgICk7XG4gICAgICB0aGlzLnJlc3QgPSB0aGlzLnJlc3QudW5zaGlmdChcbiAgICAgICAgbmV3IFQuUmF3U3ludGF4KHtcbiAgICAgICAgICB2YWx1ZTogU3ludGF4LmZyb21JZGVudGlmaWVyKG5hbWUudmFsKCksIGV4cG9ydGVkTmFtZS5leHBvcnRlZE5hbWUpLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgICBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNDb21waWxldGltZVRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICB0aGlzLmV4cGFuZE1hY3JvKCk7XG4gICAgICBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0aGlzLnRlcm0gPT09IG51bGwgJiZcbiAgICAgIHRoaXMuaXNUZXJtKGxvb2thaGVhZCkgJiZcbiAgICAgIGxvb2thaGVhZCBpbnN0YW5jZW9mIFQuRXhwcmVzc2lvblxuICAgICkge1xuICAgICAgLy8gVE9ETzogY2hlY2sgdGhhdCB0aGlzIGlzIGFjdHVhbGx5IGFuIGV4cHJlc3Npb25cbiAgICAgIHJldHVybiB0aGlzLmFkdmFuY2UoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNZaWVsZFRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdFlpZWxkRXhwcmVzc2lvbigpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnRlcm0gPT09IG51bGwgJiYgdGhpcy5pc0NsYXNzVHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0Q2xhc3Moe1xuICAgICAgICBpc0V4cHI6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0aGlzLnRlcm0gPT09IG51bGwgJiZcbiAgICAgIHRoaXMuaXNBc3luY1RyYW5zZm9ybSh0aGlzLnBlZWsoKSkgJiZcbiAgICAgICh0aGlzLmlzSWRlbnRpZmllcih0aGlzLnBlZWsoMSkpIHx8IHRoaXMuaXNQYXJlbnModGhpcy5wZWVrKDEpKSkgJiZcbiAgICAgIHRoaXMuaXNQdW5jdHVhdG9yKHRoaXMucGVlaygyKSwgJz0+JykgJiZcbiAgICAgIHRoaXMubGluZU51bWJlckVxKHRoaXMucGVlaygwKSwgdGhpcy5wZWVrKDEpKSAmJlxuICAgICAgdGhpcy5saW5lTnVtYmVyRXEodGhpcy5wZWVrKDEpLCB0aGlzLnBlZWsoMikpXG4gICAgKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0QXJyb3dFeHByZXNzaW9uKHtcbiAgICAgICAgaXNBc3luYzogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIHRoaXMudGVybSA9PT0gbnVsbCAmJlxuICAgICAgbG9va2FoZWFkICYmXG4gICAgICAodGhpcy5pc0lkZW50aWZpZXIobG9va2FoZWFkKSB8fCB0aGlzLmlzUGFyZW5zKGxvb2thaGVhZCkpICYmXG4gICAgICB0aGlzLmlzUHVuY3R1YXRvcih0aGlzLnBlZWsoMSksICc9PicpICYmXG4gICAgICB0aGlzLmxpbmVOdW1iZXJFcShsb29rYWhlYWQsIHRoaXMucGVlaygxKSlcbiAgICApIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0QXJyb3dFeHByZXNzaW9uKHsgaXNBc3luYzogZmFsc2UgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzU3ludGF4VGVtcGxhdGUobG9va2FoZWFkKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RTeW50YXhUZW1wbGF0ZSgpO1xuICAgIH1cblxuICAgIC8vICgkeDpleHByKVxuICAgIGlmICh0aGlzLnRlcm0gPT09IG51bGwgJiYgdGhpcy5pc1BhcmVucyhsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gbmV3IFQuUGFyZW50aGVzaXplZEV4cHJlc3Npb24oe1xuICAgICAgICBpbm5lcjogdGhpcy5tYXRjaFBhcmVucygpLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdGhpcy50ZXJtID09PSBudWxsICYmXG4gICAgICAodGhpcy5pc0tleXdvcmQobG9va2FoZWFkLCAndGhpcycpIHx8XG4gICAgICAgICh0aGlzLmlzSWRlbnRpZmllcihsb29rYWhlYWQpICYmXG4gICAgICAgICAgIXRoaXMuaXNJZGVudGlmaWVyKGxvb2thaGVhZCwgJ2F3YWl0JykpIHx8XG4gICAgICAgIHRoaXMuaXNLZXl3b3JkKGxvb2thaGVhZCwgJ2xldCcpIHx8XG4gICAgICAgIHRoaXMuaXNLZXl3b3JkKGxvb2thaGVhZCwgJ3lpZWxkJykgfHxcbiAgICAgICAgdGhpcy5pc051bWVyaWNMaXRlcmFsKGxvb2thaGVhZCkgfHxcbiAgICAgICAgdGhpcy5pc1N0cmluZ0xpdGVyYWwobG9va2FoZWFkKSB8fFxuICAgICAgICB0aGlzLmlzVGVtcGxhdGUobG9va2FoZWFkKSB8fFxuICAgICAgICB0aGlzLmlzQm9vbGVhbkxpdGVyYWwobG9va2FoZWFkKSB8fFxuICAgICAgICB0aGlzLmlzTnVsbExpdGVyYWwobG9va2FoZWFkKSB8fFxuICAgICAgICB0aGlzLmlzUmVndWxhckV4cHJlc3Npb24obG9va2FoZWFkKSB8fFxuICAgICAgICB0aGlzLmlzRm5EZWNsVHJhbnNmb3JtKGxvb2thaGVhZCkgfHxcbiAgICAgICAgdGhpcy5pc0FzeW5jVHJhbnNmb3JtKGxvb2thaGVhZCkgfHxcbiAgICAgICAgdGhpcy5pc0JyYWNlcyhsb29rYWhlYWQpIHx8XG4gICAgICAgIHRoaXMuaXNCcmFja2V0cyhsb29rYWhlYWQpKVxuICAgICkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RQcmltYXJ5RXhwcmVzc2lvbigpO1xuICAgIH1cblxuICAgIC8vIHByZWZpeCB1bmFyeVxuICAgIGlmIChcbiAgICAgIHRoaXMudGVybSA9PT0gbnVsbCAmJlxuICAgICAgKHRoaXMuaXNPcGVyYXRvcihsb29rYWhlYWQpIHx8IHRoaXMuaXNDdXN0b21QcmVmaXhPcGVyYXRvcihsb29rYWhlYWQpKVxuICAgICkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RVbmFyeUV4cHJlc3Npb24oKTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0aGlzLnRlcm0gPT09IG51bGwgJiZcbiAgICAgIHRoaXMuaXNWYXJCaW5kaW5nVHJhbnNmb3JtKGxvb2thaGVhZCkgJiZcbiAgICAgIGxvb2thaGVhZCBpbnN0YW5jZW9mIFQuUmF3U3ludGF4XG4gICAgKSB7XG4gICAgICBsZXQgbG9va3N0eCA9IGxvb2thaGVhZC52YWx1ZTtcbiAgICAgIC8vICRGbG93Rml4TWVcbiAgICAgIGxldCBpZCA9IHRoaXMuZ2V0RnJvbUNvbXBpbGV0aW1lRW52aXJvbm1lbnQobG9va3N0eCkuaWQ7XG4gICAgICBpZiAoaWQgIT09IGxvb2tzdHgpIHtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIHRoaXMucmVzdCA9IExpc3Qub2YoaWQpLmNvbmNhdCh0aGlzLnJlc3QpO1xuICAgICAgICByZXR1cm4gRVhQUl9MT09QX0VYUEFOU0lPTjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICAodGhpcy50ZXJtID09PSBudWxsICYmXG4gICAgICAgICh0aGlzLmlzTmV3VHJhbnNmb3JtKGxvb2thaGVhZCkgfHwgdGhpcy5pc1N1cGVyVHJhbnNmb3JtKGxvb2thaGVhZCkpKSB8fFxuICAgICAgLy8gYW5kIHRoZW4gY2hlY2sgdGhlIGNhc2VzIHdoZXJlIHRoZSB0ZXJtIHBhcnQgb2YgcCBpcyBzb21ldGhpbmcuLi5cbiAgICAgICh0aGlzLnRlcm0gJiZcbiAgICAgICAgLy8gJHg6ZXhwciAuICRwcm9wOmlkZW50XG4gICAgICAgICgodGhpcy5pc1B1bmN0dWF0b3IobG9va2FoZWFkLCAnLicpICYmXG4gICAgICAgICAgKHRoaXMuaXNJZGVudGlmaWVyKHRoaXMucGVlaygxKSkgfHwgdGhpcy5pc0tleXdvcmQodGhpcy5wZWVrKDEpKSkpIHx8XG4gICAgICAgICAgLy8gJHg6ZXhwciBbICRiOmV4cHIgXVxuICAgICAgICAgIHRoaXMuaXNCcmFja2V0cyhsb29rYWhlYWQpIHx8XG4gICAgICAgICAgLy8gJHg6ZXhwciAoLi4uKVxuICAgICAgICAgIHRoaXMuaXNQYXJlbnMobG9va2FoZWFkKSkpXG4gICAgKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdExlZnRIYW5kU2lkZUV4cHJlc3Npb24oe1xuICAgICAgICBhbGxvd0NhbGw6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyAkbDpleHByICRvcDpiaW5hcnlPcGVyYXRvciAkcjpleHByXG4gICAgaWYgKHRoaXMudGVybSAmJiB0aGlzLmlzQ3VzdG9tQmluYXJ5T3BlcmF0b3IobG9va2FoZWFkKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RCaW5hcnlFeHByZXNzaW9uKCk7XG4gICAgfVxuXG4gICAgLy8gcG9zdGZpeCB1bmFyeVxuICAgIGlmIChcbiAgICAgIHRoaXMudGVybSAmJlxuICAgICAgKHRoaXMuaXNVcGRhdGVPcGVyYXRvcihsb29rYWhlYWQpIHx8XG4gICAgICAgIHRoaXMuaXNDdXN0b21Qb3N0Zml4T3BlcmF0b3IobG9va2FoZWFkKSlcbiAgICApIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0VXBkYXRlRXhwcmVzc2lvbigpO1xuICAgIH1cblxuICAgIC8vICRsOmV4cHIgJG9wOmJpbmFyeU9wZXJhdG9yICRyOmV4cHJcbiAgICBpZiAoXG4gICAgICB0aGlzLnRlcm0gJiZcbiAgICAgICh0aGlzLmlzT3BlcmF0b3IobG9va2FoZWFkKSB8fCB0aGlzLmlzQ3VzdG9tQmluYXJ5T3BlcmF0b3IobG9va2FoZWFkKSlcbiAgICApIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0QmluYXJ5RXhwcmVzc2lvbigpO1xuICAgIH1cblxuICAgIC8vICR4OmlkIGAuLi5gXG4gICAgaWYgKHRoaXMudGVybSAmJiB0aGlzLmlzVGVtcGxhdGUobG9va2FoZWFkKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RUZW1wbGF0ZUxpdGVyYWwoKTtcbiAgICB9XG5cbiAgICAvLyAkeDpleHByID0gJGluaXQ6ZXhwclxuICAgIGlmICh0aGlzLnRlcm0gJiYgdGhpcy5pc0Fzc2lnbihsb29rYWhlYWQpKSB7XG4gICAgICBsZXQgYmluZGluZyA9IHRoaXMudHJhbnNmb3JtRGVzdHJ1Y3R1cmluZyh0aGlzLnRlcm0pO1xuICAgICAgbGV0IG9wID0gdGhpcy5tYXRjaFJhd1N5bnRheCgpO1xuXG4gICAgICBsZXQgZW5mID0gbmV3IEVuZm9yZXN0ZXIodGhpcy5yZXN0LCBMaXN0KCksIHRoaXMuY29udGV4dCk7XG4gICAgICBsZXQgaW5pdCA9IGVuZi5lbmZvcmVzdCgnZXhwcmVzc2lvbicpO1xuICAgICAgdGhpcy5yZXN0ID0gZW5mLnJlc3Q7XG5cbiAgICAgIGlmIChvcC52YWwoKSA9PT0gJz0nKSB7XG4gICAgICAgIHJldHVybiBuZXcgVC5Bc3NpZ25tZW50RXhwcmVzc2lvbih7XG4gICAgICAgICAgYmluZGluZyxcbiAgICAgICAgICBleHByZXNzaW9uOiBpbml0LFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgVC5Db21wb3VuZEFzc2lnbm1lbnRFeHByZXNzaW9uKHtcbiAgICAgICAgICBiaW5kaW5nLFxuICAgICAgICAgIG9wZXJhdG9yOiBvcC52YWwoKSxcbiAgICAgICAgICBleHByZXNzaW9uOiBpbml0LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy50ZXJtICYmIHRoaXMuaXNQdW5jdHVhdG9yKGxvb2thaGVhZCwgJz8nKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RDb25kaXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICB9XG5cbiAgICByZXR1cm4gRVhQUl9MT09QX05PX0NIQU5HRTtcbiAgfVxuXG4gIGVuZm9yZXN0UHJpbWFyeUV4cHJlc3Npb24oKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgIC8vICR4OlRoaXNFeHByZXNzaW9uXG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzS2V5d29yZChsb29rYWhlYWQsICd0aGlzJykpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0VGhpc0V4cHJlc3Npb24oKTtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgdGhpcy50ZXJtID09PSBudWxsICYmXG4gICAgICB0aGlzLmlzQXN5bmNUcmFuc2Zvcm0obG9va2FoZWFkKSAmJlxuICAgICAgdGhpcy5pc0ZuRGVjbFRyYW5zZm9ybSh0aGlzLnBlZWsoMSkpICYmXG4gICAgICB0aGlzLmxpbmVOdW1iZXJFcShsb29rYWhlYWQsIHRoaXMucGVlaygxKSlcbiAgICApIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RGdW5jdGlvbih7XG4gICAgICAgIGlzRXhwcjogdHJ1ZSxcbiAgICAgICAgaXNBc3luYzogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyAkeDppZGVudFxuICAgIGlmIChcbiAgICAgIHRoaXMudGVybSA9PT0gbnVsbCAmJlxuICAgICAgKHRoaXMuaXNJZGVudGlmaWVyKGxvb2thaGVhZCkgfHxcbiAgICAgICAgdGhpcy5pc0tleXdvcmQobG9va2FoZWFkLCAnbGV0JykgfHxcbiAgICAgICAgdGhpcy5pc0tleXdvcmQobG9va2FoZWFkLCAneWllbGQnKSlcbiAgICApIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0SWRlbnRpZmllckV4cHJlc3Npb24oKTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzTnVtZXJpY0xpdGVyYWwobG9va2FoZWFkKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3ROdW1lcmljTGl0ZXJhbCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNTdHJpbmdMaXRlcmFsKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0U3RyaW5nTGl0ZXJhbCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNUZW1wbGF0ZShsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdFRlbXBsYXRlTGl0ZXJhbCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNCb29sZWFuTGl0ZXJhbChsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdEJvb2xlYW5MaXRlcmFsKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnRlcm0gPT09IG51bGwgJiYgdGhpcy5pc051bGxMaXRlcmFsKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0TnVsbExpdGVyYWwoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzUmVndWxhckV4cHJlc3Npb24obG9va2FoZWFkKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZW5mb3Jlc3RSZWd1bGFyRXhwcmVzc2lvbkxpdGVyYWwoKTtcbiAgICB9XG4gICAgLy8gJHg6RnVuY3Rpb25FeHByZXNzaW9uXG4gICAgaWYgKHRoaXMudGVybSA9PT0gbnVsbCAmJiB0aGlzLmlzRm5EZWNsVHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVuZm9yZXN0RnVuY3Rpb24oe1xuICAgICAgICBpc0V4cHI6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8geyAkcDpwcm9wICgsKSAuLi4gfVxuICAgIGlmICh0aGlzLnRlcm0gPT09IG51bGwgJiYgdGhpcy5pc0JyYWNlcyhsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdE9iamVjdEV4cHJlc3Npb24oKTtcbiAgICB9XG4gICAgLy8gWyR4OmV4cHIgKCwpIC4uLl1cbiAgICBpZiAodGhpcy50ZXJtID09PSBudWxsICYmIHRoaXMuaXNCcmFja2V0cyhsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbmZvcmVzdEFycmF5RXhwcmVzc2lvbigpO1xuICAgIH1cbiAgICBhc3NlcnQoZmFsc2UsICdOb3QgYSBwcmltYXJ5IGV4cHJlc3Npb24nKTtcbiAgfVxuXG4gIGVuZm9yZXN0TGVmdEhhbmRTaWRlRXhwcmVzc2lvbih7IGFsbG93Q2FsbCB9OiB7IGFsbG93Q2FsbDogYm9vbGVhbiB9KSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuXG4gICAgaWYgKHRoaXMuaXNDb21waWxldGltZVRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICB0aGlzLmV4cGFuZE1hY3JvKCk7XG4gICAgICBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc1N1cGVyVHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgdGhpcy50ZXJtID0gbmV3IFQuU3VwZXIoe30pO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc05ld1RyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICB0aGlzLnRlcm0gPSB0aGlzLmVuZm9yZXN0TmV3RXhwcmVzc2lvbigpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc1RoaXNUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAgdGhpcy50ZXJtID0gdGhpcy5lbmZvcmVzdFRoaXNFeHByZXNzaW9uKCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzQnJhY2VzKGxvb2thaGVhZCkpIHtcbiAgICAgIHRoaXMudGVybSA9IHRoaXMuZW5mb3Jlc3RQcmltYXJ5RXhwcmVzc2lvbigpO1xuICAgICAgcmV0dXJuIHRoaXMudGVybTtcbiAgICB9XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG4gICAgICBpZiAodGhpcy5pc1BhcmVucyhsb29rYWhlYWQpKSB7XG4gICAgICAgIGlmICghYWxsb3dDYWxsKSB7XG4gICAgICAgICAgLy8gd2UncmUgZGVhbGluZyB3aXRoIGEgbmV3IGV4cHJlc3Npb25cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICB0aGlzLnRlcm0gJiZcbiAgICAgICAgICAgIChpc0lkZW50aWZpZXJFeHByZXNzaW9uKHRoaXMudGVybSkgfHxcbiAgICAgICAgICAgICAgaXNTdGF0aWNNZW1iZXJFeHByZXNzaW9uKHRoaXMudGVybSkgfHxcbiAgICAgICAgICAgICAgaXNDb21wdXRlZE1lbWJlckV4cHJlc3Npb24odGhpcy50ZXJtKSlcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRlcm07XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMudGVybSA9IHRoaXMuZW5mb3Jlc3RFeHByZXNzaW9uTG9vcCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMudGVybSA9IHRoaXMuZW5mb3Jlc3RDYWxsRXhwcmVzc2lvbigpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNCcmFja2V0cyhsb29rYWhlYWQpKSB7XG4gICAgICAgIHRoaXMudGVybSA9IHRoaXMudGVybVxuICAgICAgICAgID8gdGhpcy5lbmZvcmVzdENvbXB1dGVkTWVtYmVyRXhwcmVzc2lvbigpXG4gICAgICAgICAgOiB0aGlzLmVuZm9yZXN0UHJpbWFyeUV4cHJlc3Npb24oKTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHRoaXMuaXNQdW5jdHVhdG9yKGxvb2thaGVhZCwgJy4nKSAmJlxuICAgICAgICAodGhpcy5pc0lkZW50aWZpZXIodGhpcy5wZWVrKDEpKSB8fCB0aGlzLmlzS2V5d29yZCh0aGlzLnBlZWsoMSkpKVxuICAgICAgKSB7XG4gICAgICAgIHRoaXMudGVybSA9IHRoaXMuZW5mb3Jlc3RTdGF0aWNNZW1iZXJFeHByZXNzaW9uKCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNUZW1wbGF0ZShsb29rYWhlYWQpKSB7XG4gICAgICAgIHRoaXMudGVybSA9IHRoaXMuZW5mb3Jlc3RUZW1wbGF0ZUxpdGVyYWwoKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc0lkZW50aWZpZXIobG9va2FoZWFkKSkge1xuICAgICAgICBpZiAodGhpcy50ZXJtKSBicmVhaztcbiAgICAgICAgdGhpcy50ZXJtID0gbmV3IFQuSWRlbnRpZmllckV4cHJlc3Npb24oe1xuICAgICAgICAgIG5hbWU6IHRoaXMuZW5mb3Jlc3RJZGVudGlmaWVyKCksXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnRlcm07XG4gIH1cblxuICBlbmZvcmVzdEJvb2xlYW5MaXRlcmFsKCkge1xuICAgIHJldHVybiBuZXcgVC5MaXRlcmFsQm9vbGVhbkV4cHJlc3Npb24oe1xuICAgICAgdmFsdWU6IHRoaXMubWF0Y2hSYXdTeW50YXgoKS52YWwoKSA9PT0gJ3RydWUnLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RUZW1wbGF0ZUxpdGVyYWwoKSB7XG4gICAgcmV0dXJuIG5ldyBULlRlbXBsYXRlRXhwcmVzc2lvbih7XG4gICAgICB0YWc6IHRoaXMudGVybSxcbiAgICAgIGVsZW1lbnRzOiB0aGlzLmVuZm9yZXN0VGVtcGxhdGVFbGVtZW50cygpLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RTdHJpbmdMaXRlcmFsKCkge1xuICAgIHJldHVybiBuZXcgVC5MaXRlcmFsU3RyaW5nRXhwcmVzc2lvbih7XG4gICAgICB2YWx1ZTogdGhpcy5tYXRjaFJhd1N5bnRheCgpLnZhbCgpLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3ROdW1lcmljTGl0ZXJhbCgpIHtcbiAgICBsZXQgbnVtID0gdGhpcy5tYXRjaFJhd1N5bnRheCgpO1xuICAgIGlmIChudW0udmFsKCkgPT09IDEgLyAwKSB7XG4gICAgICByZXR1cm4gbmV3IFQuTGl0ZXJhbEluZmluaXR5RXhwcmVzc2lvbih7fSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgVC5MaXRlcmFsTnVtZXJpY0V4cHJlc3Npb24oe1xuICAgICAgdmFsdWU6IG51bS52YWwoKSxcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yZXN0SWRlbnRpZmllckV4cHJlc3Npb24oKSB7XG4gICAgcmV0dXJuIG5ldyBULklkZW50aWZpZXJFeHByZXNzaW9uKHtcbiAgICAgIG5hbWU6IHRoaXMubWF0Y2hSYXdTeW50YXgoKSxcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yZXN0UmVndWxhckV4cHJlc3Npb25MaXRlcmFsKCkge1xuICAgIGxldCByZVN0eCA9IHRoaXMubWF0Y2hSYXdTeW50YXgoKTtcblxuICAgIGxldCBsYXN0U2xhc2ggPSByZVN0eC50b2tlbi52YWx1ZS5sYXN0SW5kZXhPZignLycpO1xuICAgIGxldCBwYXR0ZXJuID0gcmVTdHgudG9rZW4udmFsdWUuc2xpY2UoMSwgbGFzdFNsYXNoKTtcbiAgICBsZXQgZmxhZ3MgPSByZVN0eC50b2tlbi52YWx1ZS5zbGljZShsYXN0U2xhc2ggKyAxKTtcbiAgICByZXR1cm4gbmV3IFQuTGl0ZXJhbFJlZ0V4cEV4cHJlc3Npb24oe1xuICAgICAgcGF0dGVybixcbiAgICAgIGdsb2JhbDogZmxhZ3MuaW5jbHVkZXMoJ2cnKSxcbiAgICAgIGlnbm9yZUNhc2U6IGZsYWdzLmluY2x1ZGVzKCdpJyksXG4gICAgICBtdWx0aWxpbmU6IGZsYWdzLmluY2x1ZGVzKCdtJyksXG4gICAgICBzdGlja3k6IGZsYWdzLmluY2x1ZGVzKCd5JyksXG4gICAgICB1bmljb2RlOiBmbGFncy5pbmNsdWRlcygndScpLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3ROdWxsTGl0ZXJhbCgpIHtcbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbmV3IFQuTGl0ZXJhbE51bGxFeHByZXNzaW9uKHt9KTtcbiAgfVxuXG4gIGVuZm9yZXN0VGhpc0V4cHJlc3Npb24oKSB7XG4gICAgcmV0dXJuIG5ldyBULlRoaXNFeHByZXNzaW9uKHtcbiAgICAgIHN0eDogdGhpcy5tYXRjaFJhd1N5bnRheCgpLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RBcmd1bWVudExpc3QoKSB7XG4gICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgIHdoaWxlICh0aGlzLnJlc3Quc2l6ZSA+IDApIHtcbiAgICAgIGxldCBhcmc7XG4gICAgICBpZiAodGhpcy5pc1B1bmN0dWF0b3IodGhpcy5wZWVrKCksICcuLi4nKSkge1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgYXJnID0gbmV3IFQuU3ByZWFkRWxlbWVudCh7XG4gICAgICAgICAgZXhwcmVzc2lvbjogdGhpcy5lbmZvcmVzdEV4cHJlc3Npb25Mb29wKCksXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXJnID0gdGhpcy5lbmZvcmVzdEV4cHJlc3Npb25Mb29wKCk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5yZXN0LnNpemUgPiAwKSB7XG4gICAgICAgIHRoaXMubWF0Y2hQdW5jdHVhdG9yKCcsJyk7XG4gICAgICB9XG4gICAgICByZXN1bHQucHVzaChhcmcpO1xuICAgIH1cbiAgICByZXR1cm4gTGlzdChyZXN1bHQpO1xuICB9XG5cbiAgZW5mb3Jlc3ROZXdFeHByZXNzaW9uKCkge1xuICAgIHRoaXMubWF0Y2hLZXl3b3JkKCduZXcnKTtcbiAgICBpZiAoXG4gICAgICB0aGlzLmlzUHVuY3R1YXRvcih0aGlzLnBlZWsoKSwgJy4nKSAmJlxuICAgICAgdGhpcy5pc0lkZW50aWZpZXIodGhpcy5wZWVrKDEpLCAndGFyZ2V0JylcbiAgICApIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IFQuTmV3VGFyZ2V0RXhwcmVzc2lvbih7fSk7XG4gICAgfVxuXG4gICAgbGV0IGNhbGxlZSA9IHRoaXMuZW5mb3Jlc3RMZWZ0SGFuZFNpZGVFeHByZXNzaW9uKHtcbiAgICAgIGFsbG93Q2FsbDogZmFsc2UsXG4gICAgfSk7XG4gICAgbGV0IGFyZ3M7XG4gICAgaWYgKHRoaXMuaXNQYXJlbnModGhpcy5wZWVrKCkpKSB7XG4gICAgICBhcmdzID0gdGhpcy5tYXRjaFBhcmVucygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzID0gTGlzdCgpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFQuTmV3RXhwcmVzc2lvbih7XG4gICAgICBjYWxsZWUsXG4gICAgICBhcmd1bWVudHM6IGFyZ3MsXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmVzdENvbXB1dGVkTWVtYmVyRXhwcmVzc2lvbigpIHtcbiAgICBsZXQgZW5mID0gbmV3IEVuZm9yZXN0ZXIodGhpcy5tYXRjaFNxdWFyZXMoKSwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuICAgIHJldHVybiBuZXcgVC5Db21wdXRlZE1lbWJlckV4cHJlc3Npb24oe1xuICAgICAgb2JqZWN0OiB0aGlzLnRlcm0sXG4gICAgICBleHByZXNzaW9uOiBlbmYuZW5mb3Jlc3RFeHByZXNzaW9uKCksXG4gICAgfSk7XG4gIH1cblxuICB0cmFuc2Zvcm1EZXN0cnVjdHVyaW5nKHRlcm06IGFueSkge1xuICAgIHN3aXRjaCAodGVybS50eXBlKSB7XG4gICAgICBjYXNlICdJZGVudGlmaWVyRXhwcmVzc2lvbic6XG4gICAgICAgIHJldHVybiBuZXcgVC5Bc3NpZ25tZW50VGFyZ2V0SWRlbnRpZmllcih7XG4gICAgICAgICAgbmFtZTogdGVybS5uYW1lLFxuICAgICAgICB9KTtcblxuICAgICAgY2FzZSAnUGFyZW50aGVzaXplZEV4cHJlc3Npb24nOiB7XG4gICAgICAgIGxldCBlbmYgPSBuZXcgRW5mb3Jlc3Rlcih0ZXJtLmlubmVyLCBMaXN0KCksIHRoaXMuY29udGV4dCk7XG4gICAgICAgIGxldCBleHByID0gZW5mLmVuZm9yZXN0RXhwcmVzc2lvbigpO1xuICAgICAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1EZXN0cnVjdHVyaW5nKGV4cHIpO1xuICAgICAgfVxuICAgICAgY2FzZSAnRGF0YVByb3BlcnR5JzpcbiAgICAgICAgcmV0dXJuIG5ldyBULkFzc2lnbm1lbnRUYXJnZXRQcm9wZXJ0eVByb3BlcnR5KHtcbiAgICAgICAgICBuYW1lOiB0ZXJtLm5hbWUsXG4gICAgICAgICAgYmluZGluZzogdGhpcy50cmFuc2Zvcm1EZXN0cnVjdHVyaW5nV2l0aERlZmF1bHQodGVybS5leHByZXNzaW9uKSxcbiAgICAgICAgfSk7XG4gICAgICBjYXNlICdTaG9ydGhhbmRQcm9wZXJ0eSc6XG4gICAgICAgIHJldHVybiBuZXcgVC5Bc3NpZ25tZW50VGFyZ2V0UHJvcGVydHlJZGVudGlmaWVyKHtcbiAgICAgICAgICBiaW5kaW5nOiBuZXcgVC5Bc3NpZ25tZW50VGFyZ2V0SWRlbnRpZmllcih7XG4gICAgICAgICAgICBuYW1lOiB0ZXJtLm5hbWUsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgaW5pdDogbnVsbCxcbiAgICAgICAgfSk7XG4gICAgICBjYXNlICdPYmplY3RFeHByZXNzaW9uJzpcbiAgICAgICAgcmV0dXJuIG5ldyBULk9iamVjdEFzc2lnbm1lbnRUYXJnZXQoe1xuICAgICAgICAgIHByb3BlcnRpZXM6IHRlcm0ucHJvcGVydGllcy5tYXAodCA9PiB0aGlzLnRyYW5zZm9ybURlc3RydWN0dXJpbmcodCkpLFxuICAgICAgICB9KTtcbiAgICAgIGNhc2UgJ0FycmF5RXhwcmVzc2lvbic6IHtcbiAgICAgICAgbGV0IGxhc3QgPSB0ZXJtLmVsZW1lbnRzLmxhc3QoKTtcbiAgICAgICAgaWYgKGxhc3QgIT0gbnVsbCAmJiBsYXN0LnR5cGUgPT09ICdTcHJlYWRFbGVtZW50Jykge1xuICAgICAgICAgIHJldHVybiBuZXcgVC5BcnJheUFzc2lnbm1lbnRUYXJnZXQoe1xuICAgICAgICAgICAgZWxlbWVudHM6IHRlcm0uZWxlbWVudHNcbiAgICAgICAgICAgICAgLnNsaWNlKDAsIC0xKVxuICAgICAgICAgICAgICAubWFwKHQgPT4gdCAmJiB0aGlzLnRyYW5zZm9ybURlc3RydWN0dXJpbmdXaXRoRGVmYXVsdCh0KSksXG4gICAgICAgICAgICByZXN0OiB0aGlzLnRyYW5zZm9ybURlc3RydWN0dXJpbmdXaXRoRGVmYXVsdChsYXN0LmV4cHJlc3Npb24pLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBuZXcgVC5BcnJheUFzc2lnbm1lbnRUYXJnZXQoe1xuICAgICAgICAgICAgZWxlbWVudHM6IHRlcm0uZWxlbWVudHMubWFwKFxuICAgICAgICAgICAgICB0ID0+IHQgJiYgdGhpcy50cmFuc2Zvcm1EZXN0cnVjdHVyaW5nV2l0aERlZmF1bHQodCksXG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgcmVzdDogbnVsbCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY2FzZSAnU3RhdGljUHJvcGVydHlOYW1lJzpcbiAgICAgICAgcmV0dXJuIG5ldyBULkFzc2lnbm1lbnRUYXJnZXRJZGVudGlmaWVyKHtcbiAgICAgICAgICBuYW1lOiB0ZXJtLnZhbHVlLFxuICAgICAgICB9KTtcbiAgICAgIGNhc2UgJ0NvbXB1dGVkTWVtYmVyRXhwcmVzc2lvbic6XG4gICAgICAgIHJldHVybiBuZXcgVC5Db21wdXRlZE1lbWJlckFzc2lnbm1lbnRUYXJnZXQoe1xuICAgICAgICAgIG9iamVjdDogdGVybS5vYmplY3QsXG4gICAgICAgICAgZXhwcmVzc2lvbjogdGVybS5leHByZXNzaW9uLFxuICAgICAgICB9KTtcbiAgICAgIGNhc2UgJ1N0YXRpY01lbWJlckV4cHJlc3Npb24nOlxuICAgICAgICByZXR1cm4gbmV3IFQuU3RhdGljTWVtYmVyQXNzaWdubWVudFRhcmdldCh7XG4gICAgICAgICAgb2JqZWN0OiB0ZXJtLm9iamVjdCxcbiAgICAgICAgICBwcm9wZXJ0eTogdGVybS5wcm9wZXJ0eSxcbiAgICAgICAgfSk7XG4gICAgICBjYXNlICdCaW5kaW5nUHJvcGVydHlJZGVudGlmaWVyJzpcbiAgICAgICAgcmV0dXJuIG5ldyBULkFzc2lnbm1lbnRUYXJnZXRQcm9wZXJ0eUlkZW50aWZpZXIoe1xuICAgICAgICAgIGJpbmRpbmc6IHRoaXMudHJhbnNmb3JtRGVzdHJ1Y3R1cmluZyh0ZXJtLmJpbmRpbmcpLFxuICAgICAgICAgIGluaXQ6IHRlcm0uaW5pdCxcbiAgICAgICAgfSk7XG4gICAgICBjYXNlICdCaW5kaW5nSWRlbnRpZmllcic6XG4gICAgICAgIHJldHVybiBuZXcgVC5Bc3NpZ25tZW50VGFyZ2V0SWRlbnRpZmllcih7XG4gICAgICAgICAgbmFtZTogdGVybS5uYW1lLFxuICAgICAgICB9KTtcbiAgICAgIC8vIGNhc2UgJ0FycmF5QmluZGluZyc6XG4gICAgICAvLyBjYXNlICdCaW5kaW5nUHJvcGVydHlQcm9wZXJ0eSc6XG4gICAgICAvLyBjYXNlICdCaW5kaW5nV2l0aERlZmF1bHQnOlxuICAgICAgLy8gY2FzZSAnT2JqZWN0QmluZGluZyc6XG4gICAgICBjYXNlICdPYmplY3RBc3NpZ25tZW50VGFyZ2V0JzpcbiAgICAgIGNhc2UgJ0FycmF5QXNzaWdubWVudFRhcmdldCc6XG4gICAgICBjYXNlICdBc3NpZ25tZW50VGFyZ2V0V2l0aERlZmF1bHQnOlxuICAgICAgY2FzZSAnQXNzaWdubWVudFRhcmdldElkZW50aWZpZXInOlxuICAgICAgY2FzZSAnQXNzaWdubWVudFRhcmdldFByb3BlcnR5SWRlbnRpZmllcic6XG4gICAgICBjYXNlICdBc3NpZ25tZW50VGFyZ2V0UHJvcGVydHlQcm9wZXJ0eSc6XG4gICAgICBjYXNlICdTdGF0aWNNZW1iZXJBc3NpZ25tZW50VGFyZ2V0JzpcbiAgICAgIGNhc2UgJ0NvbXB1dGVkTWVtYmVyQXNzaWdubWVudFRhcmdldCc6XG4gICAgICAgIHJldHVybiB0ZXJtO1xuICAgIH1cbiAgICBhc3NlcnQoZmFsc2UsICdub3QgaW1wbGVtZW50ZWQgeWV0IGZvciAnICsgdGVybS50eXBlKTtcbiAgfVxuXG4gIHRyYW5zZm9ybURlc3RydWN0dXJpbmdXaXRoRGVmYXVsdCh0ZXJtOiBhbnkpIHtcbiAgICBzd2l0Y2ggKHRlcm0udHlwZSkge1xuICAgICAgY2FzZSAnQXNzaWdubWVudEV4cHJlc3Npb24nOlxuICAgICAgICByZXR1cm4gbmV3IFQuQXNzaWdubWVudFRhcmdldFdpdGhEZWZhdWx0KHtcbiAgICAgICAgICBiaW5kaW5nOiB0aGlzLnRyYW5zZm9ybURlc3RydWN0dXJpbmcodGVybS5iaW5kaW5nKSxcbiAgICAgICAgICBpbml0OiB0ZXJtLmV4cHJlc3Npb24sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1EZXN0cnVjdHVyaW5nKHRlcm0pO1xuICB9XG5cbiAgZW5mb3Jlc3RDYWxsRXhwcmVzc2lvbigpIHtcbiAgICBsZXQgcGFyZW4gPSB0aGlzLm1hdGNoUGFyZW5zKCk7XG4gICAgcmV0dXJuIG5ldyBULkNhbGxFeHByZXNzaW9uRSh7XG4gICAgICBjYWxsZWU6IHRoaXMudGVybSxcbiAgICAgIGFyZ3VtZW50czogcGFyZW4sXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmVzdEFycm93RXhwcmVzc2lvbih7IGlzQXN5bmMgfTogeyBpc0FzeW5jPzogYm9vbGVhbiB9KSB7XG4gICAgbGV0IGVuZjtcbiAgICBpZiAodGhpcy5pc0lkZW50aWZpZXIodGhpcy5wZWVrKCkpKSB7XG4gICAgICBlbmYgPSBuZXcgRW5mb3Jlc3RlcihcbiAgICAgICAgTGlzdC5vZigodGhpcy5hZHZhbmNlKCk6IGFueSkpLFxuICAgICAgICBMaXN0KCksXG4gICAgICAgIHRoaXMuY29udGV4dCxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBwID0gdGhpcy5tYXRjaFBhcmVucygpO1xuICAgICAgZW5mID0gbmV3IEVuZm9yZXN0ZXIocCwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuICAgIH1cbiAgICBsZXQgcGFyYW1zID0gZW5mLmVuZm9yZXN0Rm9ybWFsUGFyYW1ldGVycygpO1xuICAgIHRoaXMubWF0Y2hQdW5jdHVhdG9yKCc9PicpO1xuXG4gICAgbGV0IGJvZHk7XG4gICAgaWYgKHRoaXMuaXNCcmFjZXModGhpcy5wZWVrKCkpKSB7XG4gICAgICBib2R5ID0gdGhpcy5tYXRjaEN1cmxpZXMoKTtcbiAgICAgIHJldHVybiBuZXcgVC5BcnJvd0V4cHJlc3Npb25FKHtcbiAgICAgICAgaXNBc3luYyxcbiAgICAgICAgcGFyYW1zLFxuICAgICAgICBib2R5LFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVuZiA9IG5ldyBFbmZvcmVzdGVyKHRoaXMucmVzdCwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuICAgICAgbGV0IG9yaWdpbmFsQXdhaXQgPSB0aGlzLmNvbnRleHQuYWxsb3dBd2FpdDtcbiAgICAgIHRoaXMuY29udGV4dC5hbGxvd0F3YWl0ID0gaXNBc3luYztcbiAgICAgIGJvZHkgPSBlbmYuZW5mb3Jlc3RFeHByZXNzaW9uTG9vcCgpO1xuICAgICAgdGhpcy5jb250ZXh0LmFsbG93QXdhaXQgPSBvcmlnaW5hbEF3YWl0O1xuICAgICAgdGhpcy5yZXN0ID0gZW5mLnJlc3Q7XG4gICAgICByZXR1cm4gbmV3IFQuQXJyb3dFeHByZXNzaW9uKHtcbiAgICAgICAgaXNBc3luYyxcbiAgICAgICAgcGFyYW1zLFxuICAgICAgICBib2R5LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZW5mb3Jlc3RZaWVsZEV4cHJlc3Npb24oKSB7XG4gICAgbGV0IGt3ZCA9IHRoaXMubWF0Y2hLZXl3b3JkKCd5aWVsZCcpO1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcblxuICAgIGlmIChcbiAgICAgIHRoaXMucmVzdC5zaXplID09PSAwIHx8XG4gICAgICAobG9va2FoZWFkICYmICF0aGlzLmxpbmVOdW1iZXJFcShrd2QsIGxvb2thaGVhZCkpXG4gICAgKSB7XG4gICAgICByZXR1cm4gbmV3IFQuWWllbGRFeHByZXNzaW9uKHtcbiAgICAgICAgZXhwcmVzc2lvbjogbnVsbCxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgaXNHZW5lcmF0b3IgPSBmYWxzZTtcbiAgICAgIGlmICh0aGlzLmlzUHVuY3R1YXRvcih0aGlzLnBlZWsoKSwgJyonKSkge1xuICAgICAgICBpc0dlbmVyYXRvciA9IHRydWU7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgfVxuICAgICAgbGV0IGV4cHIgPSB0aGlzLmVuZm9yZXN0RXhwcmVzc2lvbigpO1xuICAgICAgcmV0dXJuIG5ldyAoaXNHZW5lcmF0b3JcbiAgICAgICAgPyBULllpZWxkR2VuZXJhdG9yRXhwcmVzc2lvblxuICAgICAgICA6IFQuWWllbGRFeHByZXNzaW9uKSh7XG4gICAgICAgIGV4cHJlc3Npb246IGV4cHIsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBlbmZvcmVzdFN5bnRheFRlbXBsYXRlKCkge1xuICAgIHJldHVybiBuZXcgVC5TeW50YXhUZW1wbGF0ZSh7XG4gICAgICB0ZW1wbGF0ZTogdGhpcy5tYXRjaFJhd0RlbGltaXRlcigpLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RTdGF0aWNNZW1iZXJFeHByZXNzaW9uKCkge1xuICAgIGxldCBvYmplY3QgPSB0aGlzLnRlcm07XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgbGV0IHByb3BlcnR5ID0gdGhpcy5tYXRjaFJhd1N5bnRheCgpO1xuXG4gICAgcmV0dXJuIG5ldyBULlN0YXRpY01lbWJlckV4cHJlc3Npb24oe1xuICAgICAgb2JqZWN0OiBvYmplY3QsXG4gICAgICBwcm9wZXJ0eTogcHJvcGVydHksXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmVzdEFycmF5RXhwcmVzc2lvbigpIHtcbiAgICBsZXQgYXJyID0gdGhpcy5tYXRjaFNxdWFyZXMoKTtcblxuICAgIGxldCBlbGVtZW50cyA9IFtdO1xuXG4gICAgbGV0IGVuZiA9IG5ldyBFbmZvcmVzdGVyKGFyciwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuXG4gICAgd2hpbGUgKGVuZi5yZXN0LnNpemUgPiAwKSB7XG4gICAgICBsZXQgbG9va2FoZWFkID0gZW5mLnBlZWsoKTtcbiAgICAgIGxldCBleHByZXNzaW9uID0gbnVsbDtcbiAgICAgIGlmICghZW5mLmlzUHVuY3R1YXRvcihsb29rYWhlYWQsICcsJykpIHtcbiAgICAgICAgbGV0IGlzU3ByZWFkID0gZmFsc2U7XG4gICAgICAgIGlmIChlbmYuaXNQdW5jdHVhdG9yKGxvb2thaGVhZCwgJy4uLicpKSB7XG4gICAgICAgICAgZW5mLmFkdmFuY2UoKTtcbiAgICAgICAgICBpc1NwcmVhZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZXhwcmVzc2lvbiA9IGVuZi5lbmZvcmVzdEV4cHJlc3Npb25Mb29wKCk7XG4gICAgICAgIGlmIChleHByZXNzaW9uID09IG51bGwpIHtcbiAgICAgICAgICAvLyB0aGlzIHdhcyBhIG1hY3JvIHRoYXQgZXhwYW5kZWQgdG8gbm90aGluZ1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlbmYucmVzdC5zaXplID4gMCAmJiAhZW5mLmlzUHVuY3R1YXRvcihlbmYucGVlaygpLCAnLCcpKSB7XG4gICAgICAgICAgdGhyb3cgZW5mLmNyZWF0ZUVycm9yKGVuZi5wZWVrKCksICd1bmV4cGVjdGVkIHRva2VuJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzU3ByZWFkKSB7XG4gICAgICAgICAgZXhwcmVzc2lvbiA9IG5ldyBULlNwcmVhZEVsZW1lbnQoe1xuICAgICAgICAgICAgZXhwcmVzc2lvbixcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZW5mLmNvbnN1bWVDb21tYSgpO1xuICAgICAgZWxlbWVudHMucHVzaChleHByZXNzaW9uKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFQuQXJyYXlFeHByZXNzaW9uKHtcbiAgICAgIGVsZW1lbnRzOiBMaXN0KGVsZW1lbnRzKSxcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yZXN0T2JqZWN0RXhwcmVzc2lvbigpIHtcbiAgICBsZXQgb2JqID0gdGhpcy5tYXRjaEN1cmxpZXMoKTtcblxuICAgIGxldCBwcm9wZXJ0aWVzID0gTGlzdCgpO1xuXG4gICAgbGV0IGVuZiA9IG5ldyBFbmZvcmVzdGVyKG9iaiwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuXG4gICAgbGV0IGxhc3RQcm9wID0gbnVsbDtcbiAgICAvL1RPRE86IGltcGxlbWVudCBvYmplY3Qgc3ByZWFkIG9wZXJhdG9yIHdoZW4gaXQgbGFuZHNcbiAgICB3aGlsZSAoZW5mLnJlc3Quc2l6ZSA+IDApIHtcbiAgICAgIGxldCBwcm9wID0gZW5mLmVuZm9yZXN0UHJvcGVydHlEZWZpbml0aW9uKCk7XG5cbiAgICAgIGlmIChlbmYucmVzdC5zaXplID4gMCAmJiAhZW5mLmlzUHVuY3R1YXRvcihlbmYucGVlaygpLCAnLCcpKSB7XG4gICAgICAgIHRocm93IGVuZi5jcmVhdGVFcnJvcihlbmYucGVlaygpLCAndW5leHBlY3RlZCB0b2tlbicpO1xuICAgICAgfVxuXG4gICAgICBlbmYuY29uc3VtZUNvbW1hKCk7XG4gICAgICAvLyBUT0RPOiBidWcgaW4gaW1tdXRhYmxlIHR5cGUgZGVmaW5pdGlvbnMgZm9yIGNvbmNhdCxcbiAgICAgIC8vIHVwZ3JhZGUgdG8gdjQgd2hlbiBpdCBpcyByZWxlYXNlZFxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2ZhY2Vib29rL2ltbXV0YWJsZS1qcy9wdWxsLzExNTNcbiAgICAgIHByb3BlcnRpZXMgPSBwcm9wZXJ0aWVzLmNvbmNhdCgocHJvcDogYW55KSk7XG5cbiAgICAgIGlmIChsYXN0UHJvcCA9PT0gcHJvcCkge1xuICAgICAgICB0aHJvdyBlbmYuY3JlYXRlRXJyb3IocHJvcCwgJ2ludmFsaWQgc3ludGF4IGluIG9iamVjdCcpO1xuICAgICAgfVxuICAgICAgbGFzdFByb3AgPSBwcm9wO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVC5PYmplY3RFeHByZXNzaW9uKHtcbiAgICAgIHByb3BlcnRpZXM6IHByb3BlcnRpZXMsXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmVzdFByb3BlcnR5RGVmaW5pdGlvbigpIHtcbiAgICBsZXQgeyBtZXRob2RPcktleSwga2luZCB9ID0gdGhpcy5lbmZvcmVzdE1ldGhvZERlZmluaXRpb24oKTtcblxuICAgIHN3aXRjaCAoa2luZCkge1xuICAgICAgY2FzZSAnbWV0aG9kJzpcbiAgICAgICAgcmV0dXJuIG1ldGhvZE9yS2V5O1xuICAgICAgY2FzZSAnaWRlbnRpZmllcic6XG4gICAgICAgIGlmICh0aGlzLmlzQXNzaWduKHRoaXMucGVlaygpKSkge1xuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGxldCBpbml0ID0gdGhpcy5lbmZvcmVzdEV4cHJlc3Npb25Mb29wKCk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBULkJpbmRpbmdQcm9wZXJ0eUlkZW50aWZpZXIoe1xuICAgICAgICAgICAgaW5pdCxcbiAgICAgICAgICAgIGJpbmRpbmc6IHRoaXMudHJhbnNmb3JtRGVzdHJ1Y3R1cmluZyhtZXRob2RPcktleSksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuaXNQdW5jdHVhdG9yKHRoaXMucGVlaygpLCAnOicpKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBULlNob3J0aGFuZFByb3BlcnR5KHtcbiAgICAgICAgICAgIG5hbWU6IChtZXRob2RPcktleTogYW55KS52YWx1ZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMubWF0Y2hQdW5jdHVhdG9yKCc6Jyk7XG4gICAgbGV0IGV4cHIgPSB0aGlzLmVuZm9yZXN0RXhwcmVzc2lvbkxvb3AoKTtcblxuICAgIHJldHVybiBuZXcgVC5EYXRhUHJvcGVydHkoe1xuICAgICAgbmFtZTogbWV0aG9kT3JLZXksXG4gICAgICBleHByZXNzaW9uOiBleHByLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RNZXRob2REZWZpbml0aW9uKCkge1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICBsZXQgaXNHZW5lcmF0b3IgPSBmYWxzZTtcbiAgICBsZXQgaXNBc3luYyA9IGZhbHNlO1xuICAgIGlmICh0aGlzLmlzUHVuY3R1YXRvcihsb29rYWhlYWQsICcqJykpIHtcbiAgICAgIGlzR2VuZXJhdG9yID0gdHJ1ZTtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIHRoaXMuaXNJZGVudGlmaWVyKGxvb2thaGVhZCwgJ2FzeW5jJykgJiZcbiAgICAgICF0aGlzLmlzUHVuY3R1YXRvcih0aGlzLnBlZWsoMSksICc6JylcbiAgICApIHtcbiAgICAgIGlzQXN5bmMgPSB0cnVlO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdGhpcy5pc0lkZW50aWZpZXIobG9va2FoZWFkLCAnZ2V0JykgJiZcbiAgICAgIHRoaXMuaXNQcm9wZXJ0eU5hbWUodGhpcy5wZWVrKDEpKVxuICAgICkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICBsZXQgeyBuYW1lIH0gPSB0aGlzLmVuZm9yZXN0UHJvcGVydHlOYW1lKCk7XG4gICAgICB0aGlzLm1hdGNoUGFyZW5zKCk7XG4gICAgICBsZXQgYm9keSA9IHRoaXMubWF0Y2hDdXJsaWVzKCk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBtZXRob2RPcktleTogbmV3IFQuR2V0dGVyKHtcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIGJvZHksXG4gICAgICAgIH0pLFxuICAgICAgICBraW5kOiAnbWV0aG9kJyxcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIHRoaXMuaXNJZGVudGlmaWVyKGxvb2thaGVhZCwgJ3NldCcpICYmXG4gICAgICB0aGlzLmlzUHJvcGVydHlOYW1lKHRoaXMucGVlaygxKSlcbiAgICApIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgbGV0IHsgbmFtZSB9ID0gdGhpcy5lbmZvcmVzdFByb3BlcnR5TmFtZSgpO1xuICAgICAgbGV0IGVuZiA9IG5ldyBFbmZvcmVzdGVyKHRoaXMubWF0Y2hQYXJlbnMoKSwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuICAgICAgbGV0IHBhcmFtID0gZW5mLmVuZm9yZXN0QmluZGluZ0VsZW1lbnQoKTtcbiAgICAgIGxldCBib2R5ID0gdGhpcy5tYXRjaEN1cmxpZXMoKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1ldGhvZE9yS2V5OiBuZXcgVC5TZXR0ZXIoe1xuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgcGFyYW0sXG4gICAgICAgICAgYm9keSxcbiAgICAgICAgfSksXG4gICAgICAgIGtpbmQ6ICdtZXRob2QnLFxuICAgICAgfTtcbiAgICB9XG4gICAgbGV0IHsgbmFtZSB9ID0gdGhpcy5lbmZvcmVzdFByb3BlcnR5TmFtZSgpO1xuICAgIGlmICh0aGlzLmlzUGFyZW5zKHRoaXMucGVlaygpKSkge1xuICAgICAgbGV0IHBhcmFtcyA9IHRoaXMubWF0Y2hQYXJlbnMoKTtcbiAgICAgIGxldCBlbmYgPSBuZXcgRW5mb3Jlc3RlcihwYXJhbXMsIExpc3QoKSwgdGhpcy5jb250ZXh0KTtcbiAgICAgIGxldCBmb3JtYWxQYXJhbXMgPSBlbmYuZW5mb3Jlc3RGb3JtYWxQYXJhbWV0ZXJzKCk7XG5cbiAgICAgIGxldCBib2R5ID0gdGhpcy5tYXRjaEN1cmxpZXMoKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1ldGhvZE9yS2V5OiBuZXcgVC5NZXRob2Qoe1xuICAgICAgICAgIGlzQXN5bmMsXG4gICAgICAgICAgaXNHZW5lcmF0b3IsXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICBwYXJhbXM6IGZvcm1hbFBhcmFtcyxcbiAgICAgICAgICBib2R5LFxuICAgICAgICB9KSxcbiAgICAgICAga2luZDogJ21ldGhvZCcsXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbWV0aG9kT3JLZXk6IG5hbWUsXG4gICAgICBraW5kOlxuICAgICAgICB0aGlzLmlzSWRlbnRpZmllcihsb29rYWhlYWQpIHx8IHRoaXMuaXNLZXl3b3JkKGxvb2thaGVhZClcbiAgICAgICAgICA/ICdpZGVudGlmaWVyJ1xuICAgICAgICAgIDogJ3Byb3BlcnR5JyxcbiAgICB9O1xuICB9XG5cbiAgZW5mb3Jlc3RQcm9wZXJ0eU5hbWUoKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuXG4gICAgaWYgKHRoaXMuaXNTdHJpbmdMaXRlcmFsKGxvb2thaGVhZCkgfHwgdGhpcy5pc051bWVyaWNMaXRlcmFsKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IG5ldyBULlN0YXRpY1Byb3BlcnR5TmFtZSh7XG4gICAgICAgICAgdmFsdWU6IHRoaXMubWF0Y2hSYXdTeW50YXgoKSxcbiAgICAgICAgfSksXG4gICAgICAgIGJpbmRpbmc6IG51bGwsXG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc0JyYWNrZXRzKGxvb2thaGVhZCkpIHtcbiAgICAgIGxldCBlbmYgPSBuZXcgRW5mb3Jlc3Rlcih0aGlzLm1hdGNoU3F1YXJlcygpLCBMaXN0KCksIHRoaXMuY29udGV4dCk7XG4gICAgICBsZXQgZXhwciA9IGVuZi5lbmZvcmVzdEV4cHJlc3Npb25Mb29wKCk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBuZXcgVC5Db21wdXRlZFByb3BlcnR5TmFtZSh7XG4gICAgICAgICAgZXhwcmVzc2lvbjogZXhwcixcbiAgICAgICAgfSksXG4gICAgICAgIGJpbmRpbmc6IG51bGwsXG4gICAgICB9O1xuICAgIH1cbiAgICBsZXQgbmFtZSA9IHRoaXMubWF0Y2hSYXdTeW50YXgoKTtcbiAgICByZXR1cm4ge1xuICAgICAgbmFtZTogbmV3IFQuU3RhdGljUHJvcGVydHlOYW1lKHtcbiAgICAgICAgdmFsdWU6IG5hbWUsXG4gICAgICB9KSxcbiAgICAgIGJpbmRpbmc6IG5ldyBULkJpbmRpbmdJZGVudGlmaWVyKHtcbiAgICAgICAgbmFtZSxcbiAgICAgIH0pLFxuICAgIH07XG4gIH1cblxuICBlbmZvcmVzdEZ1bmN0aW9uKHtcbiAgICBpc0V4cHIsXG4gICAgaW5EZWZhdWx0LFxuICAgIGlzQXN5bmMsXG4gIH06IHtcbiAgICBpc0V4cHI/OiBib29sZWFuLFxuICAgIGluRGVmYXVsdD86IGJvb2xlYW4sXG4gICAgaXNBc3luYz86IGJvb2xlYW4sXG4gIH0pIHtcbiAgICBsZXQgbmFtZSA9IG51bGwsXG4gICAgICBwYXJhbXMsXG4gICAgICBib2R5O1xuICAgIGxldCBpc0dlbmVyYXRvciA9IGZhbHNlO1xuICAgIC8vIGVhdCB0aGUgZnVuY3Rpb24ga2V5d29yZFxuICAgIGxldCBmbktleXdvcmQgPSB0aGlzLm1hdGNoUmF3U3ludGF4KCk7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuXG4gICAgaWYgKHRoaXMuaXNQdW5jdHVhdG9yKGxvb2thaGVhZCwgJyonKSkge1xuICAgICAgaXNHZW5lcmF0b3IgPSB0cnVlO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuaXNQYXJlbnMobG9va2FoZWFkKSkge1xuICAgICAgbmFtZSA9IHRoaXMuZW5mb3Jlc3RCaW5kaW5nSWRlbnRpZmllcigpO1xuICAgIH0gZWxzZSBpZiAoaW5EZWZhdWx0KSB7XG4gICAgICBuYW1lID0gbmV3IFQuQmluZGluZ0lkZW50aWZpZXIoe1xuICAgICAgICBuYW1lOiBTeW50YXguZnJvbUlkZW50aWZpZXIoJypkZWZhdWx0KicsIGZuS2V5d29yZCksXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBwYXJhbXMgPSB0aGlzLm1hdGNoUGFyZW5zKCk7XG5cbiAgICBib2R5ID0gdGhpcy5tYXRjaEN1cmxpZXMoKTtcblxuICAgIGxldCBlbmYgPSBuZXcgRW5mb3Jlc3RlcihwYXJhbXMsIExpc3QoKSwgdGhpcy5jb250ZXh0KTtcbiAgICBsZXQgZm9ybWFsUGFyYW1zID0gZW5mLmVuZm9yZXN0Rm9ybWFsUGFyYW1ldGVycygpO1xuXG4gICAgcmV0dXJuIG5ldyAoaXNFeHByID8gVC5GdW5jdGlvbkV4cHJlc3Npb25FIDogVC5GdW5jdGlvbkRlY2xhcmF0aW9uRSkoe1xuICAgICAgbmFtZSxcbiAgICAgIGlzQXN5bmMsXG4gICAgICBpc0dlbmVyYXRvcixcbiAgICAgIHBhcmFtczogZm9ybWFsUGFyYW1zLFxuICAgICAgYm9keSxcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yZXN0Rm9ybWFsUGFyYW1ldGVycygpIHtcbiAgICBsZXQgaXRlbXMgPSBbXTtcbiAgICBsZXQgcmVzdCA9IG51bGw7XG4gICAgd2hpbGUgKHRoaXMucmVzdC5zaXplICE9PSAwKSB7XG4gICAgICBsZXQgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG4gICAgICBpZiAodGhpcy5pc1B1bmN0dWF0b3IobG9va2FoZWFkLCAnLi4uJykpIHtcbiAgICAgICAgdGhpcy5tYXRjaFB1bmN0dWF0b3IoJy4uLicpO1xuICAgICAgICByZXN0ID0gdGhpcy5lbmZvcmVzdEJpbmRpbmdJZGVudGlmaWVyKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaXRlbXMucHVzaCh0aGlzLmVuZm9yZXN0UGFyYW0oKSk7XG4gICAgICB0aGlzLmNvbnN1bWVDb21tYSgpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFQuRm9ybWFsUGFyYW1ldGVycyh7XG4gICAgICBpdGVtczogTGlzdChpdGVtcyksXG4gICAgICByZXN0LFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RQYXJhbSgpIHtcbiAgICByZXR1cm4gdGhpcy5lbmZvcmVzdEJpbmRpbmdFbGVtZW50KCk7XG4gIH1cblxuICBlbmZvcmVzdFVwZGF0ZUV4cHJlc3Npb24oKSB7XG4gICAgY29uc3QgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG4gICAgY29uc3QgbGVmdFRlcm0gPSB0aGlzLnRlcm07XG4gICAgaWYgKCFsb29rYWhlYWQpIHtcbiAgICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IobG9va2FoZWFkLCAnYXNzZXJ0aW9uIGZhaWx1cmU6IG9wZXJhdG9yIGlzIG51bGwnKTtcbiAgICB9XG4gICAgbGV0IG9wZXJhdG9yID0gdGhpcy5tYXRjaFJhd1N5bnRheCgpO1xuICAgIGlmICh0aGlzLmlzQ29tcGlsZXRpbWVUcmFuc2Zvcm0obG9va2FoZWFkKSkge1xuICAgICAgY29uc3Qgb3BlcmF0b3JUcmFuc2Zvcm0gPSB0aGlzLmdldEZyb21Db21waWxldGltZUVudmlyb25tZW50KG9wZXJhdG9yKTtcbiAgICAgIGlmICghb3BlcmF0b3JUcmFuc2Zvcm0gfHwgb3BlcmF0b3JUcmFuc2Zvcm0udmFsdWUudHlwZSAhPT0gJ29wZXJhdG9yJykge1xuICAgICAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKGxvb2thaGVhZCwgJ3VuZXhwZWN0ZWQgdHJhbnNmb3JtJyk7XG4gICAgICB9XG4gICAgICBsZXQgcmVzdWx0ID0gb3BlcmF0b3JUcmFuc2Zvcm0udmFsdWUuZi5jYWxsKG51bGwsIGxlZnRUZXJtKTtcbiAgICAgIGxldCBlbmYgPSBuZXcgRW5mb3Jlc3RlcihyZXN1bHQsIExpc3QoKSwgdGhpcy5jb250ZXh0KTtcbiAgICAgIHJldHVybiBlbmYuZW5mb3Jlc3RFeHByZXNzaW9uTG9vcCgpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFQuVXBkYXRlRXhwcmVzc2lvbih7XG4gICAgICBpc1ByZWZpeDogZmFsc2UsXG4gICAgICBvcGVyYXRvcjogb3BlcmF0b3IudmFsKCksXG4gICAgICBvcGVyYW5kOiB0aGlzLnRyYW5zZm9ybURlc3RydWN0dXJpbmcobGVmdFRlcm0pLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RVbmFyeUV4cHJlc3Npb24oKSB7XG4gICAgY29uc3QgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG4gICAgaWYgKCFsb29rYWhlYWQpIHtcbiAgICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IobG9va2FoZWFkLCAnYXNzZXJ0aW9uIGZhaWx1cmU6IG9wZXJhdG9yIGlzIG51bGwnKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuaXNBd2FpdFRyYW5zZm9ybShsb29rYWhlYWQpICYmICF0aGlzLmNvbnRleHQuYWxsb3dBd2FpdCkge1xuICAgICAgdGhyb3cgdGhpcy5jcmVhdGVFcnJvcihcbiAgICAgICAgbG9va2FoZWFkLFxuICAgICAgICAnYXdhaXQgaXMgb25seSBhbGxvd2VkIGluIGFzeW5jIGZ1bmN0aW9ucycsXG4gICAgICApO1xuICAgIH1cbiAgICBsZXQgb3BlcmF0b3IgPSB0aGlzLm1hdGNoUmF3U3ludGF4KCk7XG4gICAgbGV0IHByZWMsIGNvbWJpbmU7XG4gICAgaWYgKHRoaXMuaXNDb21waWxldGltZVRyYW5zZm9ybShsb29rYWhlYWQpKSB7XG4gICAgICBjb25zdCBvcGVyYXRvclRyYW5zZm9ybSA9IHRoaXMuZ2V0RnJvbUNvbXBpbGV0aW1lRW52aXJvbm1lbnQobG9va2FoZWFkKTtcbiAgICAgIGlmICghb3BlcmF0b3JUcmFuc2Zvcm0gfHwgb3BlcmF0b3JUcmFuc2Zvcm0udmFsdWUudHlwZSAhPT0gJ29wZXJhdG9yJykge1xuICAgICAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKGxvb2thaGVhZCwgJ3VuZXhwZWN0ZWQgdHJhbnNmb3JtJyk7XG4gICAgICB9XG4gICAgICBwcmVjID0gb3BlcmF0b3JUcmFuc2Zvcm0udmFsdWUucHJlYztcbiAgICAgIGNvbWJpbmUgPSByaWdodFRlcm0gPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5leHBhbmRPcGVyYXRvcihsb29rYWhlYWQsIG9wZXJhdG9yVHJhbnNmb3JtLCBbcmlnaHRUZXJtXSk7XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBhbGwgYnVpbHRpbnMgYXJlIDE2XG4gICAgICBwcmVjID0gMTY7XG4gICAgICBjb21iaW5lID0gcmlnaHRUZXJtID0+IHtcbiAgICAgICAgaWYgKG9wZXJhdG9yLnZhbCgpID09PSAnKysnIHx8IG9wZXJhdG9yLnZhbCgpID09PSAnLS0nKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBULlVwZGF0ZUV4cHJlc3Npb24oe1xuICAgICAgICAgICAgb3BlcmF0b3I6IG9wZXJhdG9yLnZhbCgpLFxuICAgICAgICAgICAgb3BlcmFuZDogdGhpcy50cmFuc2Zvcm1EZXN0cnVjdHVyaW5nKHJpZ2h0VGVybSksXG4gICAgICAgICAgICBpc1ByZWZpeDogdHJ1ZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFQuVW5hcnlFeHByZXNzaW9uKHtcbiAgICAgICAgICAgIG9wZXJhdG9yOiBvcGVyYXRvci52YWwoKSxcbiAgICAgICAgICAgIG9wZXJhbmQ6IHJpZ2h0VGVybSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aGlzLm9wQ3R4LnN0YWNrID0gdGhpcy5vcEN0eC5zdGFjay5wdXNoKHtcbiAgICAgIHByZWM6IHRoaXMub3BDdHgucHJlYyxcbiAgICAgIGNvbWJpbmU6IHRoaXMub3BDdHguY29tYmluZSxcbiAgICB9KTtcbiAgICB0aGlzLm9wQ3R4LnByZWMgPSBwcmVjO1xuICAgIHRoaXMub3BDdHguY29tYmluZSA9IHJpZ2h0VGVybSA9PiB7XG4gICAgICByZXR1cm4gY29tYmluZShyaWdodFRlcm0pO1xuICAgIH07XG4gICAgcmV0dXJuIEVYUFJfTE9PUF9PUEVSQVRPUjtcbiAgfVxuXG4gIGVuZm9yZXN0Q29uZGl0aW9uYWxFeHByZXNzaW9uKCkge1xuICAgIC8vIGZpcnN0LCBwb3AgdGhlIG9wZXJhdG9yIHN0YWNrXG4gICAgbGV0IHRlc3QgPSB0aGlzLm9wQ3R4LmNvbWJpbmUodGhpcy50ZXJtKTtcbiAgICBpZiAodGhpcy5vcEN0eC5zdGFjay5zaXplID4gMCkge1xuICAgICAgbGV0IHsgcHJlYywgY29tYmluZSB9ID0gdGhpcy5vcEN0eC5zdGFjay5sYXN0KCk7XG4gICAgICB0aGlzLm9wQ3R4LnN0YWNrID0gdGhpcy5vcEN0eC5zdGFjay5wb3AoKTtcbiAgICAgIHRoaXMub3BDdHgucHJlYyA9IHByZWM7XG4gICAgICB0aGlzLm9wQ3R4LmNvbWJpbmUgPSBjb21iaW5lO1xuICAgIH1cblxuICAgIHRoaXMubWF0Y2hQdW5jdHVhdG9yKCc/Jyk7XG4gICAgbGV0IGVuZiA9IG5ldyBFbmZvcmVzdGVyKHRoaXMucmVzdCwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuICAgIGxldCBjb25zZXF1ZW50ID0gZW5mLmVuZm9yZXN0RXhwcmVzc2lvbkxvb3AoKTtcbiAgICBlbmYubWF0Y2hQdW5jdHVhdG9yKCc6Jyk7XG4gICAgZW5mID0gbmV3IEVuZm9yZXN0ZXIoZW5mLnJlc3QsIExpc3QoKSwgdGhpcy5jb250ZXh0KTtcbiAgICBsZXQgYWx0ZXJuYXRlID0gZW5mLmVuZm9yZXN0RXhwcmVzc2lvbkxvb3AoKTtcbiAgICB0aGlzLnJlc3QgPSBlbmYucmVzdDtcbiAgICByZXR1cm4gbmV3IFQuQ29uZGl0aW9uYWxFeHByZXNzaW9uKHtcbiAgICAgIHRlc3QsXG4gICAgICBjb25zZXF1ZW50LFxuICAgICAgYWx0ZXJuYXRlLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3Jlc3RCaW5hcnlFeHByZXNzaW9uKCkge1xuICAgIGxldCBsZWZ0VGVybSA9IHRoaXMudGVybTtcbiAgICBjb25zdCBvcFN0eDogYW55ID0gdGhpcy5wZWVrKCk7XG4gICAgaWYgKCFvcFN0eCkge1xuICAgICAgdGhyb3cgdGhpcy5jcmVhdGVFcnJvcihvcFN0eCwgJ2Fzc2VydGlvbiBmYWlsdXJlOiBvcFN0eCBpcyBudWxsJyk7XG4gICAgfVxuXG4gICAgbGV0IHByZWMsIGFzc29jLCBjb21iaW5lO1xuICAgIGlmICh0aGlzLmlzQ29tcGlsZXRpbWVUcmFuc2Zvcm0odGhpcy5wZWVrKCkpKSB7XG4gICAgICBjb25zdCBvcGVyYXRvclRyYW5zZm9ybSA9IHRoaXMuZ2V0RnJvbUNvbXBpbGV0aW1lRW52aXJvbm1lbnQob3BTdHgudmFsdWUpO1xuICAgICAgaWYgKCFvcGVyYXRvclRyYW5zZm9ybSB8fCBvcGVyYXRvclRyYW5zZm9ybS52YWx1ZS50eXBlICE9PSAnb3BlcmF0b3InKSB7XG4gICAgICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3Iob3BTdHgudmFsdWUsICd1bmV4cGVjdGVkIHRyYW5zZm9ybScpO1xuICAgICAgfVxuICAgICAgcHJlYyA9IG9wZXJhdG9yVHJhbnNmb3JtLnZhbHVlLnByZWM7XG4gICAgICBhc3NvYyA9IG9wZXJhdG9yVHJhbnNmb3JtLnZhbHVlLmFzc29jO1xuICAgICAgY29tYmluZSA9IChsZWZ0OiBhbnksIHJpZ2h0KSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLmV4cGFuZE9wZXJhdG9yKG9wU3R4LCBvcGVyYXRvclRyYW5zZm9ybSwgW2xlZnQsIHJpZ2h0XSk7XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBwcmVjID0gZ2V0T3BlcmF0b3JQcmVjKG9wU3R4LnZhbHVlLnZhbCgpKTtcbiAgICAgIGFzc29jID0gZ2V0T3BlcmF0b3JBc3NvYyhvcFN0eC52YWx1ZS52YWwoKSk7XG4gICAgICBjb21iaW5lID0gKGxlZnQsIHJpZ2h0KSA9PlxuICAgICAgICBuZXcgVC5CaW5hcnlFeHByZXNzaW9uKHtcbiAgICAgICAgICBsZWZ0LFxuICAgICAgICAgIHJpZ2h0LFxuICAgICAgICAgIG9wZXJhdG9yOiBvcFN0eC52YWx1ZS52YWwoKSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKG9wZXJhdG9yTHQodGhpcy5vcEN0eC5wcmVjLCBwcmVjLCBhc3NvYykpIHtcbiAgICAgIHRoaXMub3BDdHguc3RhY2sgPSB0aGlzLm9wQ3R4LnN0YWNrLnB1c2goe1xuICAgICAgICBwcmVjOiB0aGlzLm9wQ3R4LnByZWMsXG4gICAgICAgIGNvbWJpbmU6IHRoaXMub3BDdHguY29tYmluZSxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5vcEN0eC5wcmVjID0gcHJlYztcbiAgICAgIHRoaXMub3BDdHguY29tYmluZSA9IHJpZ2h0VGVybSA9PiB7XG4gICAgICAgIHJldHVybiBjb21iaW5lKGxlZnRUZXJtLCByaWdodFRlcm0pO1xuICAgICAgfTtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIEVYUFJfTE9PUF9PUEVSQVRPUjtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHRlcm0gPSB0aGlzLm9wQ3R4LmNvbWJpbmUobGVmdFRlcm0pO1xuICAgICAgLy8gdGhpcy5yZXN0IGRvZXMgbm90IGNoYW5nZVxuICAgICAgbGV0IHsgcHJlYywgY29tYmluZSB9ID0gdGhpcy5vcEN0eC5zdGFjay5sYXN0KCk7XG4gICAgICB0aGlzLm9wQ3R4LnN0YWNrID0gdGhpcy5vcEN0eC5zdGFjay5wb3AoKTtcbiAgICAgIHRoaXMub3BDdHgucHJlYyA9IHByZWM7XG4gICAgICB0aGlzLm9wQ3R4LmNvbWJpbmUgPSBjb21iaW5lO1xuICAgICAgcmV0dXJuIHRlcm07XG4gICAgfVxuICB9XG5cbiAgZW5mb3Jlc3RUZW1wbGF0ZUVsZW1lbnRzKCkge1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLm1hdGNoVGVtcGxhdGUoKTtcbiAgICBsZXQgZWxlbWVudHMgPSBsb29rYWhlYWQudG9rZW4uaXRlbXMubWFwKGl0ID0+IHtcbiAgICAgIGlmICh0aGlzLmlzRGVsaW1pdGVyKGl0KSkge1xuICAgICAgICBsZXQgZW5mID0gbmV3IEVuZm9yZXN0ZXIoXG4gICAgICAgICAgaXQuaW5uZXIuc2xpY2UoMSwgaXQuaW5uZXIuc2l6ZSAtIDEpLFxuICAgICAgICAgIExpc3QoKSxcbiAgICAgICAgICB0aGlzLmNvbnRleHQsXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBlbmYuZW5mb3Jlc3QoJ2V4cHJlc3Npb24nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgVC5UZW1wbGF0ZUVsZW1lbnQoe1xuICAgICAgICByYXdWYWx1ZTogaXQudmFsdWUudG9rZW4uc2xpY2UudGV4dCxcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBlbGVtZW50cztcbiAgfVxuXG4gIGV4cGFuZE1hY3JvKCkge1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICB3aGlsZSAodGhpcy5pc0NvbXBpbGV0aW1lVHJhbnNmb3JtKGxvb2thaGVhZCkpIHtcbiAgICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFJhd1N5bnRheCgpO1xuXG4gICAgICBsZXQgc3ludGF4VHJhbnNmb3JtID0gdGhpcy5nZXRGcm9tQ29tcGlsZXRpbWVFbnZpcm9ubWVudChuYW1lKTtcbiAgICAgIGlmIChzeW50YXhUcmFuc2Zvcm0gPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKFxuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgYFRoZSBtYWNybyAke25hbWUucmVzb2x2ZShcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5waGFzZSxcbiAgICAgICAgICApfSBkb2VzIG5vdCBoYXZlIGEgYm91bmQgdmFsdWVgLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygc3ludGF4VHJhbnNmb3JtLnZhbHVlLmYgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgdGhpcy5jcmVhdGVFcnJvcihcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIGBUaGUgbWFjcm8gJHtuYW1lLnJlc29sdmUoXG4gICAgICAgICAgICB0aGlzLmNvbnRleHQucGhhc2UsXG4gICAgICAgICAgKX0gd2FzIG5vdCBib3VuZCB0byBhIGNhbGxhYmxlIHZhbHVlOiAke3N5bnRheFRyYW5zZm9ybS52YWx1ZS5mfWAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBsZXQgdXNlU2l0ZVNjb3BlID0gZnJlc2hTY29wZSgndScpO1xuICAgICAgbGV0IGludHJvZHVjZWRTY29wZSA9IGZyZXNoU2NvcGUoJ2knKTtcbiAgICAgIC8vIFRPRE86IG5lZWRzIHRvIGJlIGEgbGlzdCBvZiBzY29wZXMgSSB0aGlua1xuICAgICAgdGhpcy5jb250ZXh0LnVzZVNjb3BlID0gdXNlU2l0ZVNjb3BlO1xuXG4gICAgICBsZXQgY3R4ID0gbmV3IE1hY3JvQ29udGV4dChcbiAgICAgICAgdGhpcyxcbiAgICAgICAgbmFtZSxcbiAgICAgICAgdGhpcy5jb250ZXh0LFxuICAgICAgICB1c2VTaXRlU2NvcGUsXG4gICAgICAgIGludHJvZHVjZWRTY29wZSxcbiAgICAgICk7XG5cbiAgICAgIGxldCByZXN1bHQgPSBzYW5pdGl6ZVJlcGxhY2VtZW50VmFsdWVzKFxuICAgICAgICBzeW50YXhUcmFuc2Zvcm0udmFsdWUuZi5jYWxsKG51bGwsIGN0eCksXG4gICAgICApO1xuICAgICAgaWYgKCFMaXN0LmlzTGlzdChyZXN1bHQpKSB7XG4gICAgICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IoXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICAnbWFjcm8gbXVzdCByZXR1cm4gYSBsaXN0IGJ1dCBnb3Q6ICcgKyByZXN1bHQsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBsZXQgc2NvcGVSZWR1Y2VyID0gbmV3IFNjb3BlUmVkdWNlcihcbiAgICAgICAgW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNjb3BlOiBpbnRyb2R1Y2VkU2NvcGUsXG4gICAgICAgICAgICBwaGFzZTogQUxMX1BIQVNFUyxcbiAgICAgICAgICAgIGZsaXA6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgdGhpcy5jb250ZXh0LmJpbmRpbmdzLFxuICAgICAgICB0cnVlLFxuICAgICAgKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5tYXAodGVybXMgPT4ge1xuICAgICAgICBpZiAodGVybXMgaW5zdGFuY2VvZiBTeW50YXgpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFQuUmF3U3ludGF4KHtcbiAgICAgICAgICAgIHZhbHVlOiB0ZXJtcyxcbiAgICAgICAgICAgIC8vICRGbG93Rml4TWU6IGZsb3cgZG9lc24ndCBrbm93IGFib3V0IHJlZHVjZSBvbiB0ZXJtcyB5ZXRcbiAgICAgICAgICB9KS5yZWR1Y2Uoc2NvcGVSZWR1Y2VyKTtcbiAgICAgICAgfSBlbHNlIGlmICghKHRlcm1zIGluc3RhbmNlb2YgVGVybSkpIHtcbiAgICAgICAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKFxuICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICdtYWNybyBtdXN0IHJldHVybiBzeW50YXggb2JqZWN0cyBvciB0ZXJtcyBidXQgZ290OiAnICsgdGVybXMsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGVybXMucmVkdWNlKHNjb3BlUmVkdWNlcik7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5yZXN0ID0gcmVzdWx0LmNvbmNhdChjdHguX3Jlc3QodGhpcykpO1xuICAgICAgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG4gICAgfVxuICB9XG5cbiAgZXhwYW5kT3BlcmF0b3IobmFtZTogVGVybSwgb3BlcmF0b3JUcmFuc2Zvcm06IGFueSwgYXJnczogQXJyYXk8VGVybT4pIHtcbiAgICBsZXQgdXNlU2l0ZVNjb3BlID0gZnJlc2hTY29wZSgndScpO1xuICAgIGxldCBpbnRyb2R1Y2VkU2NvcGUgPSBmcmVzaFNjb3BlKCdpJyk7XG4gICAgLy8gVE9ETzogbmVlZHMgdG8gYmUgYSBsaXN0IG9mIHNjb3BlcyBJIHRoaW5rXG4gICAgdGhpcy5jb250ZXh0LnVzZVNjb3BlID0gdXNlU2l0ZVNjb3BlO1xuICAgIGFyZ3MgPSBhcmdzLm1hcChhcmcgPT4ge1xuICAgICAgLy8gJEZsb3dGaXhNZTogZmxvdyBkb2Vzbid0IGtub3cgYWJvdXQgcmVkdWNlIG9uIHRlcm1zIHlldFxuICAgICAgcmV0dXJuIGFyZy5yZWR1Y2UoXG4gICAgICAgIG5ldyBTY29wZVJlZHVjZXIoXG4gICAgICAgICAgW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzY29wZTogdXNlU2l0ZVNjb3BlLFxuICAgICAgICAgICAgICBwaGFzZTogQUxMX1BIQVNFUyxcbiAgICAgICAgICAgICAgZmxpcDogZmFsc2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzY29wZTogaW50cm9kdWNlZFNjb3BlLFxuICAgICAgICAgICAgICBwaGFzZTogQUxMX1BIQVNFUyxcbiAgICAgICAgICAgICAgZmxpcDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICB0aGlzLmNvbnRleHQuYmluZGluZ3MsXG4gICAgICAgICksXG4gICAgICApO1xuICAgIH0pO1xuICAgIGxldCByZXN1bHQgPSBzYW5pdGl6ZVJlcGxhY2VtZW50VmFsdWVzKFxuICAgICAgb3BlcmF0b3JUcmFuc2Zvcm0udmFsdWUuZi5hcHBseShudWxsLCBhcmdzKSxcbiAgICApO1xuICAgIGxldCBzY29wZVJlZHVjZXIgPSBuZXcgU2NvcGVSZWR1Y2VyKFxuICAgICAgW1xuICAgICAgICB7XG4gICAgICAgICAgc2NvcGU6IGludHJvZHVjZWRTY29wZSxcbiAgICAgICAgICBwaGFzZTogQUxMX1BIQVNFUyxcbiAgICAgICAgICBmbGlwOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHRoaXMuY29udGV4dC5iaW5kaW5ncyxcbiAgICAgIHRydWUsXG4gICAgKTtcbiAgICByZXN1bHQgPSByZXN1bHQubWFwKHRlcm1zID0+IHtcbiAgICAgIGlmICh0ZXJtcyBpbnN0YW5jZW9mIFN5bnRheCkge1xuICAgICAgICByZXR1cm4gbmV3IFQuUmF3U3ludGF4KHtcbiAgICAgICAgICB2YWx1ZTogdGVybXMsXG4gICAgICAgICAgLy8gJEZsb3dGaXhNZTogZmxvdyBkb2Vzbid0IGtub3cgYWJvdXQgcmVkdWNlIG9uIHRlcm1zIHlldFxuICAgICAgICB9KS5yZWR1Y2Uoc2NvcGVSZWR1Y2VyKTtcbiAgICAgIH0gZWxzZSBpZiAoISh0ZXJtcyBpbnN0YW5jZW9mIFRlcm0pKSB7XG4gICAgICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IoXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICAnbWFjcm8gbXVzdCByZXR1cm4gc3ludGF4IG9iamVjdHMgb3IgdGVybXMgYnV0IGdvdDogJyArIHRlcm1zLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRlcm1zLnJlZHVjZShzY29wZVJlZHVjZXIpO1xuICAgIH0pO1xuICAgIGxldCBlbmYgPSBuZXcgRW5mb3Jlc3RlcihyZXN1bHQsIExpc3QoKSwgdGhpcy5jb250ZXh0KTtcbiAgICByZXR1cm4gZW5mLmVuZm9yZXN0RXhwcmVzc2lvbkxvb3AoKTtcbiAgfVxuXG4gIGNvbnN1bWVTZW1pY29sb24oKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuXG4gICAgaWYgKGxvb2thaGVhZCAmJiB0aGlzLmlzUHVuY3R1YXRvcihsb29rYWhlYWQsICc7JykpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN1bWVDb21tYSgpIHtcbiAgICBsZXQgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG5cbiAgICBpZiAobG9va2FoZWFkICYmIHRoaXMuaXNQdW5jdHVhdG9yKGxvb2thaGVhZCwgJywnKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgfVxuICB9XG5cbiAgc2FmZUNoZWNrKG9iajogPyhTeW50YXggfCBUZXJtKSwgdHlwZTogYW55LCB2YWw6ID9zdHJpbmcgPSBudWxsKSB7XG4gICAgaWYgKG9iaiBpbnN0YW5jZW9mIFRlcm0pIHtcbiAgICAgIGlmIChvYmogaW5zdGFuY2VvZiBULlJhd1N5bnRheCkge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIG9iai52YWx1ZSAmJlxuICAgICAgICAgICh0eXBlb2Ygb2JqLnZhbHVlLm1hdGNoID09PSAnZnVuY3Rpb24nXG4gICAgICAgICAgICA/IG9iai52YWx1ZS5tYXRjaCh0eXBlLCB2YWwpXG4gICAgICAgICAgICA6IGZhbHNlKVxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmIChvYmogaW5zdGFuY2VvZiBULlJhd0RlbGltaXRlcikge1xuICAgICAgICByZXR1cm4gdHlwZSA9PT0gJ2RlbGltaXRlcicgfHwgb2JqLmtpbmQgPT09IHR5cGU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAoXG4gICAgICBvYmogJiYgKHR5cGVvZiBvYmoubWF0Y2ggPT09ICdmdW5jdGlvbicgPyBvYmoubWF0Y2godHlwZSwgdmFsKSA6IGZhbHNlKVxuICAgICk7XG4gIH1cblxuICBpc1Rlcm0odGVybTogYW55KSB7XG4gICAgcmV0dXJuIHRlcm0gJiYgdGVybSBpbnN0YW5jZW9mIFRlcm07XG4gIH1cblxuICBpc0VPRihvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5zYWZlQ2hlY2sob2JqLCAnZW9mJyk7XG4gIH1cblxuICBpc0lkZW50aWZpZXIob2JqOiA/KFN5bnRheCB8IFRlcm0pLCB2YWw6ID9zdHJpbmcgPSBudWxsKSB7XG4gICAgcmV0dXJuIHRoaXMuc2FmZUNoZWNrKG9iaiwgJ2lkZW50aWZpZXInLCB2YWwpO1xuICB9XG5cbiAgaXNQcm9wZXJ0eU5hbWUob2JqOiA/KFN5bnRheCB8IFRlcm0pKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuaXNJZGVudGlmaWVyKG9iaikgfHxcbiAgICAgIHRoaXMuaXNLZXl3b3JkKG9iaikgfHxcbiAgICAgIHRoaXMuaXNOdW1lcmljTGl0ZXJhbChvYmopIHx8XG4gICAgICB0aGlzLmlzU3RyaW5nTGl0ZXJhbChvYmopIHx8XG4gICAgICB0aGlzLmlzQnJhY2tldHMob2JqKVxuICAgICk7XG4gIH1cblxuICBpc051bWVyaWNMaXRlcmFsKG9iajogPyhTeW50YXggfCBUZXJtKSwgdmFsOiA/c3RyaW5nID0gbnVsbCkge1xuICAgIHJldHVybiB0aGlzLnNhZmVDaGVjayhvYmosICdudW1iZXInLCB2YWwpO1xuICB9XG5cbiAgaXNTdHJpbmdMaXRlcmFsKG9iajogPyhTeW50YXggfCBUZXJtKSwgdmFsOiA/c3RyaW5nID0gbnVsbCkge1xuICAgIHJldHVybiB0aGlzLnNhZmVDaGVjayhvYmosICdzdHJpbmcnLCB2YWwpO1xuICB9XG5cbiAgaXNUZW1wbGF0ZShvYmo6ID8oU3ludGF4IHwgVGVybSksIHZhbDogP3N0cmluZyA9IG51bGwpIHtcbiAgICByZXR1cm4gdGhpcy5zYWZlQ2hlY2sob2JqLCAndGVtcGxhdGUnLCB2YWwpO1xuICB9XG5cbiAgaXNTeW50YXhUZW1wbGF0ZShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5zYWZlQ2hlY2sob2JqLCAnc3ludGF4VGVtcGxhdGUnKTtcbiAgfVxuXG4gIGlzQm9vbGVhbkxpdGVyYWwob2JqOiA/KFN5bnRheCB8IFRlcm0pLCB2YWw6ID9zdHJpbmcgPSBudWxsKSB7XG4gICAgcmV0dXJuIHRoaXMuc2FmZUNoZWNrKG9iaiwgJ2Jvb2xlYW4nLCB2YWwpO1xuICB9XG5cbiAgaXNOdWxsTGl0ZXJhbChvYmo6ID8oU3ludGF4IHwgVGVybSksIHZhbDogP3N0cmluZyA9IG51bGwpIHtcbiAgICByZXR1cm4gdGhpcy5zYWZlQ2hlY2sob2JqLCAnbnVsbCcsIHZhbCk7XG4gIH1cblxuICBpc1JlZ3VsYXJFeHByZXNzaW9uKG9iajogPyhTeW50YXggfCBUZXJtKSwgdmFsOiA/c3RyaW5nID0gbnVsbCkge1xuICAgIHJldHVybiB0aGlzLnNhZmVDaGVjayhvYmosICdyZWd1bGFyRXhwcmVzc2lvbicsIHZhbCk7XG4gIH1cblxuICBpc0RlbGltaXRlcihvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5zYWZlQ2hlY2sob2JqLCAnZGVsaW1pdGVyJyk7XG4gIH1cblxuICBpc1BhcmVucyhvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5zYWZlQ2hlY2sob2JqLCAncGFyZW5zJyk7XG4gIH1cblxuICBpc0JyYWNlcyhvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5zYWZlQ2hlY2sob2JqLCAnYnJhY2VzJyk7XG4gIH1cblxuICBpc0JyYWNrZXRzKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLnNhZmVDaGVjayhvYmosICdicmFja2V0cycpO1xuICB9XG5cbiAgaXNBc3NpZ24ob2JqOiA/KFN5bnRheCB8IFRlcm0pLCB2YWw6ID9zdHJpbmcgPSBudWxsKSB7XG4gICAgcmV0dXJuIHRoaXMuc2FmZUNoZWNrKG9iaiwgJ2Fzc2lnbicsIHZhbCk7XG4gIH1cblxuICBpc0tleXdvcmQob2JqOiA/KFN5bnRheCB8IFRlcm0pLCB2YWw6ID9zdHJpbmcgPSBudWxsKSB7XG4gICAgcmV0dXJuIHRoaXMuc2FmZUNoZWNrKG9iaiwgJ2tleXdvcmQnLCB2YWwpO1xuICB9XG5cbiAgaXNQdW5jdHVhdG9yKG9iajogPyhTeW50YXggfCBUZXJtKSwgdmFsOiA/c3RyaW5nID0gbnVsbCkge1xuICAgIHJldHVybiB0aGlzLnNhZmVDaGVjayhvYmosICdwdW5jdHVhdG9yJywgdmFsKTtcbiAgfVxuXG4gIGlzT3BlcmF0b3Iob2JqOiA/KFN5bnRheCB8IFRlcm0pKSB7XG4gICAgcmV0dXJuIChcbiAgICAgICh0aGlzLnNhZmVDaGVjayhvYmosICdwdW5jdHVhdG9yJykgfHxcbiAgICAgICAgdGhpcy5zYWZlQ2hlY2sob2JqLCAnaWRlbnRpZmllcicpIHx8XG4gICAgICAgIHRoaXMuc2FmZUNoZWNrKG9iaiwgJ2tleXdvcmQnKSkgJiZcbiAgICAgICgob2JqIGluc3RhbmNlb2YgVC5SYXdTeW50YXggJiYgaXNPcGVyYXRvcihvYmoudmFsdWUpKSB8fFxuICAgICAgICAob2JqIGluc3RhbmNlb2YgU3ludGF4ICYmIGlzT3BlcmF0b3Iob2JqKSkpXG4gICAgKTtcbiAgfVxuXG4gIGlzQ3VzdG9tUHJlZml4T3BlcmF0b3Iob2JqOiBhbnkpIHtcbiAgICBpZiAodGhpcy5pc0NvbXBpbGV0aW1lVHJhbnNmb3JtKG9iaikpIHtcbiAgICAgIGxldCB0ID0gdGhpcy5nZXRGcm9tQ29tcGlsZXRpbWVFbnZpcm9ubWVudChvYmoudmFsdWUpO1xuICAgICAgcmV0dXJuIHQgJiYgdC52YWx1ZS5hc3NvYyA9PT0gJ3ByZWZpeCc7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlzQ3VzdG9tUG9zdGZpeE9wZXJhdG9yKG9iajogYW55KSB7XG4gICAgaWYgKHRoaXMuaXNDb21waWxldGltZVRyYW5zZm9ybShvYmopKSB7XG4gICAgICBsZXQgdCA9IHRoaXMuZ2V0RnJvbUNvbXBpbGV0aW1lRW52aXJvbm1lbnQob2JqLnZhbHVlKTtcbiAgICAgIHJldHVybiB0ICYmIHQudmFsdWUuYXNzb2MgPT09ICdwb3N0Zml4JztcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaXNDdXN0b21CaW5hcnlPcGVyYXRvcihvYmo6IGFueSkge1xuICAgIGlmICh0aGlzLmlzQ29tcGlsZXRpbWVUcmFuc2Zvcm0ob2JqKSkge1xuICAgICAgbGV0IHQgPSB0aGlzLmdldEZyb21Db21waWxldGltZUVudmlyb25tZW50KG9iai52YWx1ZSk7XG4gICAgICByZXR1cm4gdCAmJiAodC52YWx1ZS5hc3NvYyA9PT0gJ2xlZnQnIHx8IHQudmFsdWUuYXNzb2MgPT09ICdyaWdodCcpO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpc1VwZGF0ZU9wZXJhdG9yKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLnNhZmVDaGVjayhvYmosICdwdW5jdHVhdG9yJywgJysrJykgfHxcbiAgICAgIHRoaXMuc2FmZUNoZWNrKG9iaiwgJ3B1bmN0dWF0b3InLCAnLS0nKVxuICAgICk7XG4gIH1cblxuICBzYWZlUmVzb2x2ZShvYmo6ID8oU3ludGF4IHwgVGVybSksIHBoYXNlOiBudW1iZXIgfCB7fSkge1xuICAgIGlmIChvYmogaW5zdGFuY2VvZiBULlJhd1N5bnRheCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiBvYmoudmFsdWUucmVzb2x2ZSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICA/IEp1c3Qob2JqLnZhbHVlLnJlc29sdmUocGhhc2UpKVxuICAgICAgICA6IE5vdGhpbmcoKTtcbiAgICB9IGVsc2UgaWYgKG9iaiBpbnN0YW5jZW9mIFN5bnRheCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiBvYmoucmVzb2x2ZSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICA/IEp1c3Qob2JqLnJlc29sdmUocGhhc2UpKVxuICAgICAgICA6IE5vdGhpbmcoKTtcbiAgICB9XG4gICAgcmV0dXJuIE5vdGhpbmcoKTtcbiAgfVxuXG4gIGlzVHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSwgdHJhbnM6IGFueSkge1xuICAgIHJldHVybiB0aGlzLnNhZmVSZXNvbHZlKG9iaiwgdGhpcy5jb250ZXh0LnBoYXNlKVxuICAgICAgLm1hcChcbiAgICAgICAgbmFtZSA9PlxuICAgICAgICAgIHRoaXMuY29udGV4dC5lbnYuZ2V0KG5hbWUpID09PSB0cmFucyB8fFxuICAgICAgICAgIHRoaXMuY29udGV4dC5zdG9yZS5nZXQobmFtZSkgPT09IHRyYW5zLFxuICAgICAgKVxuICAgICAgLmdldE9yRWxzZShmYWxzZSk7XG4gIH1cblxuICBpc1RyYW5zZm9ybUluc3RhbmNlKG9iajogPyhTeW50YXggfCBUZXJtKSwgdHJhbnM6IGFueSkge1xuICAgIHJldHVybiB0aGlzLnNhZmVSZXNvbHZlKG9iaiwgdGhpcy5jb250ZXh0LnBoYXNlKVxuICAgICAgLm1hcChcbiAgICAgICAgbmFtZSA9PlxuICAgICAgICAgIHRoaXMuY29udGV4dC5lbnYuZ2V0KG5hbWUpIGluc3RhbmNlb2YgdHJhbnMgfHxcbiAgICAgICAgICB0aGlzLmNvbnRleHQuc3RvcmUuZ2V0KG5hbWUpIGluc3RhbmNlb2YgdHJhbnMsXG4gICAgICApXG4gICAgICAuZ2V0T3JFbHNlKGZhbHNlKTtcbiAgfVxuXG4gIGlzRm5EZWNsVHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtKG9iaiwgRnVuY3Rpb25EZWNsVHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzVmFyRGVjbFRyYW5zZm9ybShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5pc1RyYW5zZm9ybShvYmosIFZhcmlhYmxlRGVjbFRyYW5zZm9ybSk7XG4gIH1cblxuICBpc0xldERlY2xUcmFuc2Zvcm0ob2JqOiA/KFN5bnRheCB8IFRlcm0pKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNUcmFuc2Zvcm0ob2JqLCBMZXREZWNsVHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzQ29uc3REZWNsVHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtKG9iaiwgQ29uc3REZWNsVHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzU3ludGF4RGVjbFRyYW5zZm9ybShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5pc1RyYW5zZm9ybShvYmosIFN5bnRheERlY2xUcmFuc2Zvcm0pO1xuICB9XG5cbiAgaXNTeW50YXhyZWNEZWNsVHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtKG9iaiwgU3ludGF4cmVjRGVjbFRyYW5zZm9ybSk7XG4gIH1cblxuICBpc1JldHVyblN0bXRUcmFuc2Zvcm0ob2JqOiA/KFN5bnRheCB8IFRlcm0pKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNUcmFuc2Zvcm0ob2JqLCBSZXR1cm5TdGF0ZW1lbnRUcmFuc2Zvcm0pO1xuICB9XG5cbiAgaXNXaGlsZVRyYW5zZm9ybShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5pc1RyYW5zZm9ybShvYmosIFdoaWxlVHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzRm9yVHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtKG9iaiwgRm9yVHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzU3dpdGNoVHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtKG9iaiwgU3dpdGNoVHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzQnJlYWtUcmFuc2Zvcm0ob2JqOiA/KFN5bnRheCB8IFRlcm0pKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNUcmFuc2Zvcm0ob2JqLCBCcmVha1RyYW5zZm9ybSk7XG4gIH1cblxuICBpc0NvbnRpbnVlVHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtKG9iaiwgQ29udGludWVUcmFuc2Zvcm0pO1xuICB9XG5cbiAgaXNEb1RyYW5zZm9ybShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5pc1RyYW5zZm9ybShvYmosIERvVHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzRGVidWdnZXJUcmFuc2Zvcm0ob2JqOiA/KFN5bnRheCB8IFRlcm0pKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNUcmFuc2Zvcm0ob2JqLCBEZWJ1Z2dlclRyYW5zZm9ybSk7XG4gIH1cblxuICBpc1dpdGhUcmFuc2Zvcm0ob2JqOiA/KFN5bnRheCB8IFRlcm0pKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNUcmFuc2Zvcm0ob2JqLCBXaXRoVHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzSW1wb3J0VHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtKG9iaiwgSW1wb3J0VHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzRXhwb3J0VHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtKG9iaiwgRXhwb3J0VHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzVHJ5VHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtKG9iaiwgVHJ5VHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzVGhyb3dUcmFuc2Zvcm0ob2JqOiA/KFN5bnRheCB8IFRlcm0pKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNUcmFuc2Zvcm0ob2JqLCBUaHJvd1RyYW5zZm9ybSk7XG4gIH1cblxuICBpc09wZXJhdG9yRGVjbFRyYW5zZm9ybShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5pc1RyYW5zZm9ybShvYmosIE9wZXJhdG9yRGVjbFRyYW5zZm9ybSk7XG4gIH1cblxuICBpc0lmVHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtKG9iaiwgSWZUcmFuc2Zvcm0pO1xuICB9XG5cbiAgaXNOZXdUcmFuc2Zvcm0ob2JqOiA/KFN5bnRheCB8IFRlcm0pKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNUcmFuc2Zvcm0ob2JqLCBOZXdUcmFuc2Zvcm0pO1xuICB9XG5cbiAgaXNTdXBlclRyYW5zZm9ybShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5pc1RyYW5zZm9ybShvYmosIFN1cGVyVHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzVGhpc1RyYW5zZm9ybShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5pc1RyYW5zZm9ybShvYmosIFRoaXNUcmFuc2Zvcm0pO1xuICB9XG5cbiAgaXNDbGFzc1RyYW5zZm9ybShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5pc1RyYW5zZm9ybShvYmosIENsYXNzVHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzWWllbGRUcmFuc2Zvcm0ob2JqOiA/KFN5bnRheCB8IFRlcm0pKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNUcmFuc2Zvcm0ob2JqLCBZaWVsZFRyYW5zZm9ybSk7XG4gIH1cblxuICBpc0FzeW5jVHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtKG9iaiwgQXN5bmNUcmFuc2Zvcm0pO1xuICB9XG5cbiAgaXNBd2FpdFRyYW5zZm9ybShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5pc1RyYW5zZm9ybShvYmosIEF3YWl0VHJhbnNmb3JtKTtcbiAgfVxuXG4gIGlzRGVmYXVsdFRyYW5zZm9ybShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5pc1RyYW5zZm9ybShvYmosIERlZmF1bHRUcmFuc2Zvcm0pO1xuICB9XG5cbiAgaXNDb21waWxldGltZVRyYW5zZm9ybShvYmo6ID8oU3ludGF4IHwgVGVybSkpIHtcbiAgICByZXR1cm4gdGhpcy5pc1RyYW5zZm9ybUluc3RhbmNlKG9iaiwgQ29tcGlsZXRpbWVUcmFuc2Zvcm0pO1xuICB9XG5cbiAgaXNNb2R1bGVOYW1lc3BhY2VUcmFuc2Zvcm0ob2JqOiA/VGVybSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtSW5zdGFuY2Uob2JqLCBNb2R1bGVOYW1lc3BhY2VUcmFuc2Zvcm0pO1xuICB9XG5cbiAgaXNWYXJCaW5kaW5nVHJhbnNmb3JtKG9iajogPyhTeW50YXggfCBUZXJtKSkge1xuICAgIHJldHVybiB0aGlzLmlzVHJhbnNmb3JtSW5zdGFuY2Uob2JqLCBWYXJCaW5kaW5nVHJhbnNmb3JtKTtcbiAgfVxuXG4gIGdldEZyb21Db21waWxldGltZUVudmlyb25tZW50KHRlcm06IGFueSkge1xuICAgIGlmICh0aGlzLmNvbnRleHQuZW52Lmhhcyh0ZXJtLnJlc29sdmUodGhpcy5jb250ZXh0LnBoYXNlKSkpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbnRleHQuZW52LmdldCh0ZXJtLnJlc29sdmUodGhpcy5jb250ZXh0LnBoYXNlKSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmNvbnRleHQuc3RvcmUuZ2V0KHRlcm0ucmVzb2x2ZSh0aGlzLmNvbnRleHQucGhhc2UpKTtcbiAgfVxuXG4gIGxpbmVOdW1iZXJFcShhOiA/KFRlcm0gfCBTeW50YXgpLCBiOiA/KFN5bnRheCB8IFRlcm0pKSB7XG4gICAgaWYgKCEoYSAmJiBiKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gZ2V0TGluZU51bWJlcihhKSA9PT0gZ2V0TGluZU51bWJlcihiKTtcbiAgfVxuXG4gIG1hdGNoUmF3RGVsaW1pdGVyKCk6IExpc3Q8VGVybT4ge1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLmFkdmFuY2UoKTtcbiAgICBpZiAobG9va2FoZWFkIGluc3RhbmNlb2YgVC5SYXdEZWxpbWl0ZXIpIHtcbiAgICAgIC8vICRGbG93Rml4TWU6IHRlcm1zIGFyZSBjdXJyZW50bHkgdHlwZWQgd2l0aCBhcnJheXMgbm90IGxpc3RzXG4gICAgICByZXR1cm4gbG9va2FoZWFkLmlubmVyO1xuICAgIH1cbiAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKGxvb2thaGVhZCwgJ2V4cGVjdGluZyBhIFJhd0RlbGltaXRlcicpO1xuICB9XG5cbiAgbWF0Y2hSYXdTeW50YXgoKTogU3ludGF4IHtcbiAgICBsZXQgbG9va2FoZWFkID0gdGhpcy5hZHZhbmNlKCk7XG4gICAgaWYgKGxvb2thaGVhZCBpbnN0YW5jZW9mIFQuUmF3U3ludGF4KSB7XG4gICAgICByZXR1cm4gbG9va2FoZWFkLnZhbHVlO1xuICAgIH1cbiAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKGxvb2thaGVhZCwgJ2V4cGVjdGluZyBhIFJhd1N5bnRheCcpO1xuICB9XG5cbiAgbWF0Y2hJZGVudGlmaWVyKHZhbD86IHN0cmluZykge1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICBpZiAodGhpcy5pc0lkZW50aWZpZXIobG9va2FoZWFkLCB2YWwpKSB7XG4gICAgICByZXR1cm4gdGhpcy5tYXRjaFJhd1N5bnRheCgpO1xuICAgIH1cbiAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKGxvb2thaGVhZCwgJ2V4cGVjdGluZyBhbiBpZGVudGlmaWVyJyk7XG4gIH1cblxuICBtYXRjaEtleXdvcmQodmFsOiBzdHJpbmcpIHtcbiAgICBsZXQgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG4gICAgaWYgKHRoaXMuaXNLZXl3b3JkKGxvb2thaGVhZCwgdmFsKSkge1xuICAgICAgcmV0dXJuIHRoaXMubWF0Y2hSYXdTeW50YXgoKTtcbiAgICB9XG4gICAgdGhyb3cgdGhpcy5jcmVhdGVFcnJvcihsb29rYWhlYWQsICdleHBlY3RpbmcgJyArIHZhbCk7XG4gIH1cblxuICBtYXRjaExpdGVyYWwoKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgIGlmIChcbiAgICAgIHRoaXMuaXNOdW1lcmljTGl0ZXJhbChsb29rYWhlYWQpIHx8XG4gICAgICB0aGlzLmlzU3RyaW5nTGl0ZXJhbChsb29rYWhlYWQpIHx8XG4gICAgICB0aGlzLmlzQm9vbGVhbkxpdGVyYWwobG9va2FoZWFkKSB8fFxuICAgICAgdGhpcy5pc051bGxMaXRlcmFsKGxvb2thaGVhZCkgfHxcbiAgICAgIHRoaXMuaXNUZW1wbGF0ZShsb29rYWhlYWQpIHx8XG4gICAgICB0aGlzLmlzUmVndWxhckV4cHJlc3Npb24obG9va2FoZWFkKVxuICAgICkge1xuICAgICAgcmV0dXJuIHRoaXMubWF0Y2hSYXdTeW50YXgoKTtcbiAgICB9XG4gICAgdGhyb3cgdGhpcy5jcmVhdGVFcnJvcihsb29rYWhlYWQsICdleHBlY3RpbmcgYSBsaXRlcmFsJyk7XG4gIH1cblxuICBtYXRjaFN0cmluZ0xpdGVyYWwoKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgIGlmICh0aGlzLmlzU3RyaW5nTGl0ZXJhbChsb29rYWhlYWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5tYXRjaFJhd1N5bnRheCgpO1xuICAgIH1cbiAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKGxvb2thaGVhZCwgJ2V4cGVjdGluZyBhIHN0cmluZyBsaXRlcmFsJyk7XG4gIH1cblxuICBtYXRjaFRlbXBsYXRlKCkge1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICBpZiAodGhpcy5pc1RlbXBsYXRlKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLm1hdGNoUmF3U3ludGF4KCk7XG4gICAgfVxuICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IobG9va2FoZWFkLCAnZXhwZWN0aW5nIGEgdGVtcGxhdGUgbGl0ZXJhbCcpO1xuICB9XG5cbiAgbWF0Y2hQYXJlbnMoKTogTGlzdDxUZXJtPiB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMucGVlaygpO1xuICAgIGlmICh0aGlzLmlzUGFyZW5zKGxvb2thaGVhZCkpIHtcbiAgICAgIGxldCBpbm5lciA9IHRoaXMubWF0Y2hSYXdEZWxpbWl0ZXIoKTtcbiAgICAgIHJldHVybiBpbm5lci5zbGljZSgxLCBpbm5lci5zaXplIC0gMSk7XG4gICAgfVxuICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IobG9va2FoZWFkLCAnZXhwZWN0aW5nIHBhcmVucycpO1xuICB9XG5cbiAgbWF0Y2hDdXJsaWVzKCkge1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLnBlZWsoKTtcbiAgICBpZiAodGhpcy5pc0JyYWNlcyhsb29rYWhlYWQpKSB7XG4gICAgICBsZXQgaW5uZXIgPSB0aGlzLm1hdGNoUmF3RGVsaW1pdGVyKCk7XG4gICAgICByZXR1cm4gaW5uZXIuc2xpY2UoMSwgaW5uZXIuc2l6ZSAtIDEpO1xuICAgIH1cbiAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKGxvb2thaGVhZCwgJ2V4cGVjdGluZyBjdXJseSBicmFjZXMnKTtcbiAgfVxuXG4gIG1hdGNoU3F1YXJlcygpOiBMaXN0PFRlcm0+IHtcbiAgICBsZXQgbG9va2FoZWFkID0gdGhpcy5wZWVrKCk7XG4gICAgaWYgKHRoaXMuaXNCcmFja2V0cyhsb29rYWhlYWQpKSB7XG4gICAgICBsZXQgaW5uZXIgPSB0aGlzLm1hdGNoUmF3RGVsaW1pdGVyKCk7XG4gICAgICByZXR1cm4gaW5uZXIuc2xpY2UoMSwgaW5uZXIuc2l6ZSAtIDEpO1xuICAgIH1cbiAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKGxvb2thaGVhZCwgJ2V4cGVjdGluZyBzcXVhcmUgYnJhY2VzJyk7XG4gIH1cblxuICBtYXRjaFVuYXJ5T3BlcmF0b3IoKSB7XG4gICAgbGV0IGxvb2thaGVhZCA9IHRoaXMubWF0Y2hSYXdTeW50YXgoKTtcbiAgICBpZiAoaXNVbmFyeU9wZXJhdG9yKGxvb2thaGVhZCkpIHtcbiAgICAgIHJldHVybiBsb29rYWhlYWQ7XG4gICAgfVxuICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IobG9va2FoZWFkLCAnZXhwZWN0aW5nIGEgdW5hcnkgb3BlcmF0b3InKTtcbiAgfVxuXG4gIG1hdGNoUHVuY3R1YXRvcih2YWw6IHN0cmluZykge1xuICAgIGxldCBsb29rYWhlYWQgPSB0aGlzLm1hdGNoUmF3U3ludGF4KCk7XG4gICAgaWYgKHRoaXMuaXNQdW5jdHVhdG9yKGxvb2thaGVhZCkpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBpZiAobG9va2FoZWFkLnZhbCgpID09PSB2YWwpIHtcbiAgICAgICAgICByZXR1cm4gbG9va2FoZWFkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IHRoaXMuY3JlYXRlRXJyb3IoXG4gICAgICAgICAgICBsb29rYWhlYWQsXG4gICAgICAgICAgICAnZXhwZWN0aW5nIGEgJyArIHZhbCArICcgcHVuY3R1YXRvcicsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGxvb2thaGVhZDtcbiAgICB9XG4gICAgdGhyb3cgdGhpcy5jcmVhdGVFcnJvcihsb29rYWhlYWQsICdleHBlY3RpbmcgYSBwdW5jdHVhdG9yJyk7XG4gIH1cblxuICBjcmVhdGVFcnJvcihzdHg6ID8oU3ludGF4IHwgVGVybSksIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIGxldCBjdHggPSAnJztcbiAgICBsZXQgb2ZmZW5kaW5nID0gc3R4O1xuICAgIGlmICh0aGlzLnJlc3Quc2l6ZSA+IDApIHtcbiAgICAgIGN0eCA9IHRoaXMucmVzdFxuICAgICAgICAuc2xpY2UoMCwgMjApXG4gICAgICAgIC5tYXAodGVybSA9PiB7XG4gICAgICAgICAgaWYgKHRlcm0gaW5zdGFuY2VvZiBULlJhd0RlbGltaXRlcikge1xuICAgICAgICAgICAgcmV0dXJuIHRlcm0uaW5uZXI7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBMaXN0Lm9mKHRlcm0pO1xuICAgICAgICB9KVxuICAgICAgICAuZmxhdHRlbigpXG4gICAgICAgIC5tYXAocyA9PiB7XG4gICAgICAgICAgbGV0IHN2YWwgPSBzIGluc3RhbmNlb2YgVC5SYXdTeW50YXggPyBzLnZhbHVlLnZhbCgpIDogcy50b1N0cmluZygpO1xuICAgICAgICAgIGlmIChzID09PSBvZmZlbmRpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiAnX18nICsgc3ZhbCArICdfXyc7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBzdmFsO1xuICAgICAgICB9KVxuICAgICAgICAuam9pbignICcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdHggPSBvZmZlbmRpbmcgPT0gbnVsbCA/ICcnIDogb2ZmZW5kaW5nLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgRXJyb3IobWVzc2FnZSArICdcXG4nICsgY3R4KTtcbiAgfVxufVxuIl19