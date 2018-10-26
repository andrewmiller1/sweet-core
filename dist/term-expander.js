'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _immutable = require('immutable');

var _terms = require('./terms');

var _sweetSpec = require('sweet-spec');

var T = _interopRequireWildcard(_sweetSpec);

var _scope = require('./scope');

var _compiler = require('./compiler');

var _compiler2 = _interopRequireDefault(_compiler);

var _syntax = require('./syntax');

var _syntax2 = _interopRequireDefault(_syntax);

var _enforester = require('./enforester');

var _templateProcessor = require('./template-processor');

var _astDispatcher = require('./ast-dispatcher');

var _astDispatcher2 = _interopRequireDefault(_astDispatcher);

var _scopeReducer = require('./scope-reducer');

var _scopeReducer2 = _interopRequireDefault(_scopeReducer);

var _symbol = require('./symbol');

var _transforms = require('./transforms');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

class TermExpander extends _astDispatcher2.default {
  constructor(context) {
    super('expand', true);
    this.context = context;
  }

  expand(term) {
    return this.dispatch(term);
  }

  expandRawSyntax(term) {
    return term;
  }

  expandRawDelimiter(term) {
    return term;
  }

  expandTemplateExpression(term) {
    return new T.TemplateExpression({
      tag: term.tag == null ? null : this.expand(term.tag),
      elements: term.elements.toArray()
    });
  }

  expandBreakStatement(term) {
    return new T.BreakStatement({
      label: term.label ? term.label.val() : null
    });
  }

  expandDoWhileStatement(term) {
    return new T.DoWhileStatement({
      body: this.expand(term.body),
      test: this.expand(term.test)
    });
  }

  expandWithStatement(term) {
    return new T.WithStatement({
      body: this.expand(term.body),
      object: this.expand(term.object)
    });
  }

  expandDebuggerStatement(term) {
    return term;
  }

  expandContinueStatement(term) {
    return new T.ContinueStatement({
      label: term.label ? term.label.val() : null
    });
  }

  expandSwitchStatementWithDefault(term) {
    return new T.SwitchStatementWithDefault({
      discriminant: this.expand(term.discriminant),
      preDefaultCases: term.preDefaultCases.map(c => this.expand(c)).toArray(),
      defaultCase: this.expand(term.defaultCase),
      postDefaultCases: term.postDefaultCases.map(c => this.expand(c)).toArray()
    });
  }

  expandComputedMemberExpression(term) {
    return new T.ComputedMemberExpression({
      object: this.expand(term.object),
      expression: this.expand(term.expression)
    });
  }

  expandSwitchStatement(term) {
    return new T.SwitchStatement({
      discriminant: this.expand(term.discriminant),
      cases: term.cases.map(c => this.expand(c)).toArray()
    });
  }

  expandFormalParameters(term) {
    let rest = term.rest == null ? null : this.expand(term.rest);
    return new T.FormalParameters({
      items: term.items.map(i => this.expand(i)),
      rest
    });
  }

  expandArrowExpressionE(term) {
    return this.doFunctionExpansion(term, 'ArrowExpression');
  }

  expandArrowExpression(term) {
    return this.doFunctionExpansion(term, 'ArrowExpression');
  }

  expandSwitchDefault(term) {
    return new T.SwitchDefault({
      consequent: term.consequent.map(c => this.expand(c)).toArray()
    });
  }

  expandSwitchCase(term) {
    return new T.SwitchCase({
      test: this.expand(term.test),
      consequent: term.consequent.map(c => this.expand(c)).toArray()
    });
  }

  expandForInStatement(term) {
    return new T.ForInStatement({
      left: this.expand(term.left),
      right: this.expand(term.right),
      body: this.expand(term.body)
    });
  }

  expandTryCatchStatement(term) {
    return new T.TryCatchStatement({
      body: this.expand(term.body),
      catchClause: this.expand(term.catchClause)
    });
  }

  expandTryFinallyStatement(term) {
    let catchClause = term.catchClause == null ? null : this.expand(term.catchClause);
    return new T.TryFinallyStatement({
      body: this.expand(term.body),
      catchClause,
      finalizer: this.expand(term.finalizer)
    });
  }

  expandCatchClause(term) {
    return new T.CatchClause({
      binding: this.expand(term.binding),
      body: this.expand(term.body)
    });
  }

  expandThrowStatement(term) {
    return new T.ThrowStatement({
      expression: this.expand(term.expression)
    });
  }

  expandForOfStatement(term) {
    return new T.ForOfStatement({
      left: this.expand(term.left),
      right: this.expand(term.right),
      body: this.expand(term.body)
    });
  }

  expandBindingIdentifier(term) {
    return term;
  }

  expandAssignmentTargetIdentifier(term) {
    return term;
  }

  expandBindingPropertyIdentifier(term) {
    return term;
  }

  expandAssignmentTargetPropertyIdentifier(term) {
    return term;
  }

  expandBindingPropertyProperty(term) {
    return new T.BindingPropertyProperty({
      name: this.expand(term.name),
      binding: this.expand(term.binding)
    });
  }

  expandAssignmentTargetPropertyProperty(term) {
    return new T.AssignmentTargetPropertyProperty({
      name: this.expand(term.name),
      binding: this.expand(term.binding)
    });
  }

  expandComputedPropertyName(term) {
    return new T.ComputedPropertyName({
      expression: this.expand(term.expression)
    });
  }

  expandObjectBinding(term) {
    return new T.ObjectBinding({
      properties: term.properties.map(t => this.expand(t)).toArray()
    });
  }

  expandObjectAssignmentTarget(term) {
    return new T.ObjectAssignmentTarget({
      properties: term.properties.map(t => this.expand(t)).toArray()
    });
  }

  expandArrayBinding(term) {
    let rest = term.rest == null ? null : this.expand(term.rest);
    return new T.ArrayBinding({
      elements: term.elements.map(t => t == null ? null : this.expand(t)).toArray(),
      rest
    });
  }

  expandArrayAssignmentTarget(term) {
    let rest = term.rest == null ? null : this.expand(term.rest);
    return new T.ArrayAssignmentTarget({
      elements: term.elements.map(t => t == null ? null : this.expand(t)).toArray(),
      rest
    });
  }

  expandBindingWithDefault(term) {
    return new T.BindingWithDefault({
      binding: this.expand(term.binding),
      init: this.expand(term.init)
    });
  }

  expandAssignmentTargetWithDefault(term) {
    return new T.AssignmentTargetWithDefault({
      binding: this.expand(term.binding),
      init: this.expand(term.init)
    });
  }

  expandShorthandProperty(term) {
    // because hygiene, shorthand properties must turn into DataProperties
    return new T.DataProperty({
      name: new T.StaticPropertyName({
        value: term.name
      }),
      expression: new T.IdentifierExpression({
        name: term.name
      })
    });
  }

  expandForStatement(term) {
    let init = term.init == null ? null : this.expand(term.init);
    let test = term.test == null ? null : this.expand(term.test);
    let update = term.update == null ? null : this.expand(term.update);
    let body = this.expand(term.body);
    return new T.ForStatement({ init, test, update, body });
  }

  expandYieldExpression(term) {
    let expr = term.expression == null ? null : this.expand(term.expression);
    return new T.YieldExpression({
      expression: expr
    });
  }

  expandYieldGeneratorExpression(term) {
    let expr = term.expression == null ? null : this.expand(term.expression);
    return new T.YieldGeneratorExpression({
      expression: expr
    });
  }

  expandWhileStatement(term) {
    return new T.WhileStatement({
      test: this.expand(term.test),
      body: this.expand(term.body)
    });
  }

  expandIfStatement(term) {
    let consequent = term.consequent == null ? null : this.expand(term.consequent);
    let alternate = term.alternate == null ? null : this.expand(term.alternate);
    return new T.IfStatement({
      test: this.expand(term.test),
      consequent: consequent,
      alternate: alternate
    });
  }

  expandBlockStatement(term) {
    return new T.BlockStatement({
      block: this.expand(term.block)
    });
  }

  expandBlock(term) {
    let scope = (0, _scope.freshScope)('block');
    this.context.currentScope.push(scope);
    let compiler = new _compiler2.default(this.context.phase, this.context.env, this.context.store, this.context);

    let markedBody, bodyTerm;
    markedBody = term.statements.map(b => b.reduce(new _scopeReducer2.default([{ scope, phase: _syntax.ALL_PHASES, flip: false }], this.context.bindings)));
    bodyTerm = new T.Block({
      statements: compiler.compile(markedBody)
    });
    this.context.currentScope.pop();
    return bodyTerm;
  }

  expandVariableDeclarationStatement(term) {
    return new T.VariableDeclarationStatement({
      declaration: this.expand(term.declaration)
    });
  }
  expandReturnStatement(term) {
    if (term.expression == null) {
      return term;
    }
    return new T.ReturnStatement({
      expression: this.expand(term.expression)
    });
  }

  expandClassDeclaration(term) {
    return new T.ClassDeclaration({
      name: term.name == null ? null : this.expand(term.name),
      super: term.super == null ? null : this.expand(term.super),
      elements: term.elements.map(el => this.expand(el)).toArray()
    });
  }

  expandClassExpression(term) {
    return new T.ClassExpression({
      name: term.name == null ? null : this.expand(term.name),
      super: term.super == null ? null : this.expand(term.super),
      elements: term.elements.map(el => this.expand(el)).toArray()
    });
  }

  expandClassElement(term) {
    return new T.ClassElement({
      isStatic: term.isStatic,
      method: this.expand(term.method)
    });
  }

  expandThisExpression(term) {
    return term;
  }

  expandSyntaxTemplate(term) {
    let r = (0, _templateProcessor.processTemplate)(term.template.slice(1, term.template.size - 1));
    let ident = this.context.getTemplateIdentifier();
    this.context.templateMap.set(ident, r.template);
    let name = _syntax2.default.fromIdentifier('syntaxTemplate', term.template.first().value);
    let callee = new T.IdentifierExpression({
      name: name
    });

    let expandedInterps = r.interp.map(i => {
      let enf = new _enforester.Enforester(i, (0, _immutable.List)(), this.context);
      return this.expand(enf.enforest('expression'));
    });

    let args = _immutable.List.of(new T.LiteralNumericExpression({ value: ident })).concat(expandedInterps);

    return new T.CallExpression({
      callee,
      arguments: args
    });
  }

  expandStaticMemberExpression(term) {
    return new T.StaticMemberExpression({
      object: this.expand(term.object),
      property: term.property
    });
  }

  expandStaticMemberAssignmentTarget(term) {
    return new T.StaticMemberAssignmentTarget({
      object: this.expand(term.object),
      property: term.property
    });
  }

  expandComputedMemberAssignmentTarget(term) {
    return new T.ComputedMemberAssignmentTarget({
      object: this.expand(term.object),
      expression: this.expand(term.expression)
    });
  }

  expandArrayExpression(term) {
    return new T.ArrayExpression({
      elements: term.elements.map(t => t == null ? t : this.expand(t))
    });
  }

  expandImport(term) {
    return term;
  }

  expandImportNamespace(term) {
    return term;
  }

  expandExport(term) {
    return new T.Export({
      declaration: this.expand(term.declaration)
    });
  }

  expandExportDefault(term) {
    return new T.ExportDefault({
      body: this.expand(term.body)
    });
  }

  expandExportFrom(term) {
    return term;
  }

  expandExportLocals(term) {
    return term;
  }

  expandExportAllFrom(term) {
    return term;
  }

  expandExportFromSpecifier(term) {
    return term;
  }

  expandExportLocalSpecifier(term) {
    return term;
  }

  expandStaticPropertyName(term) {
    return term;
  }

  expandDataProperty(term) {
    return new T.DataProperty({
      name: this.expand(term.name),
      expression: this.expand(term.expression)
    });
  }

  expandObjectExpression(term) {
    return new T.ObjectExpression({
      properties: term.properties.map(t => this.expand(t))
    });
  }

  expandVariableDeclarator(term) {
    let init = term.init == null ? null : this.expand(term.init);
    return new T.VariableDeclarator({
      binding: this.expand(term.binding),
      init: init
    });
  }

  expandVariableDeclaration(term) {
    if (term.kind === 'syntax' || term.kind === 'syntaxrec' || term.kind === 'operator') {
      return term;
    }
    return new T.VariableDeclaration({
      kind: term.kind,
      declarators: term.declarators.map(d => this.expand(d))
    });
  }

  expandParenthesizedExpression(term) {
    if (term.inner.size === 0) {
      throw new Error('unexpected end of input');
    }
    let enf = new _enforester.Enforester(term.inner, (0, _immutable.List)(), this.context);
    let lookahead = enf.peek();
    let t = enf.enforestExpression();
    if (t == null || enf.rest.size > 0) {
      if (enf.rest.size === 0) {
        throw enf.createError(')', 'unexpected token');
      }
      throw enf.createError(lookahead, 'unexpected syntax');
    }
    return this.expand(t);
  }

  expandUnaryExpression(term) {
    if (term.operator === 'await') {
      return new T.AwaitExpression({
        expression: this.expand(term.operand)
      });
    }
    return new T.UnaryExpression({
      operator: term.operator,
      operand: this.expand(term.operand)
    });
  }

  expandUpdateExpression(term) {
    return new T.UpdateExpression({
      isPrefix: term.isPrefix,
      operator: term.operator,
      operand: this.expand(term.operand)
    });
  }

  expandBinaryExpression(term) {
    let left = this.expand(term.left);
    let right = this.expand(term.right);
    return new T.BinaryExpression({
      left: left,
      operator: term.operator,
      right: right
    });
  }

  expandConditionalExpression(term) {
    return new T.ConditionalExpression({
      test: this.expand(term.test),
      consequent: this.expand(term.consequent),
      alternate: this.expand(term.alternate)
    });
  }

  expandNewTargetExpression(term) {
    return term;
  }

  expandNewExpression(term) {
    let callee = this.expand(term.callee);
    let enf = new _enforester.Enforester(term.arguments, (0, _immutable.List)(), this.context);
    let args = enf.enforestArgumentList().map(arg => this.expand(arg));
    return new T.NewExpression({
      callee,
      arguments: args.toArray()
    });
  }

  expandSuper(term) {
    return term;
  }

  expandCallExpressionE(term) {
    let callee = this.expand(term.callee);
    let enf = new _enforester.Enforester(term.arguments, (0, _immutable.List)(), this.context);
    let args = enf.enforestArgumentList().map(arg => this.expand(arg));
    return new T.CallExpression({
      callee: callee,
      arguments: args
    });
  }

  expandSpreadElement(term) {
    return new T.SpreadElement({
      expression: this.expand(term.expression)
    });
  }

  expandExpressionStatement(term) {
    let child = this.expand(term.expression);
    return new T.ExpressionStatement({
      expression: child
    });
  }

  expandLabeledStatement(term) {
    return new T.LabeledStatement({
      label: term.label.val(),
      body: this.expand(term.body)
    });
  }

  doFunctionExpansion(term, type) {
    let scope = (0, _scope.freshScope)('fun');
    let params;
    let self = this;
    if (type !== 'Getter' && type !== 'Setter') {
      // TODO: need to register the parameter bindings again
      params = term.params.reduce(new class extends T.default.CloneReducer {
        reduceBindingIdentifier(term) {
          let name = term.name.addScope(scope, self.context.bindings, _syntax.ALL_PHASES);
          let newBinding = (0, _symbol.gensym)(name.val());

          self.context.env.set(newBinding.toString(), new _transforms.VarBindingTransform(name));
          self.context.bindings.add(name, {
            binding: newBinding,
            phase: self.context.phase,
            skipDup: true
          });
          return new T.BindingIdentifier({ name });
        }
      }());
      params = this.expand(params);
    }
    this.context.currentScope.push(scope);
    let compiler = new _compiler2.default(this.context.phase, this.context.env, this.context.store, Object.assign({}, this.context, { allowAwait: term.isAsync }));

    let bodyTerm;
    let scopeReducer = new _scopeReducer2.default([{ scope, phase: _syntax.ALL_PHASES, flip: false }], this.context.bindings);
    if (term.body instanceof T.default) {
      // Arrow functions have a single term as their body
      bodyTerm = this.expand(term.body.reduce(scopeReducer));
    } else {
      let compiledBody = compiler.compile(term.body.map(b => b.reduce(scopeReducer)));
      const directives = compiledBody.takeWhile(s => (0, _terms.isExpressionStatement)(s) && (0, _terms.isLiteralStringExpression)(s.expression)).map(s => new T.Directive({ rawValue: s.expression.value }));
      bodyTerm = new T.FunctionBody({
        directives: directives,
        statements: compiledBody.slice(directives.size)
      });
    }
    this.context.currentScope.pop();

    switch (type) {
      case 'Getter':
        return new T.Getter({
          name: this.expand(term.name),
          body: bodyTerm
        });
      case 'Setter':
        return new T.Setter({
          name: this.expand(term.name),
          param: term.param,
          body: bodyTerm
        });
      case 'Method':
        return new T.Method({
          name: term.name,
          isAsync: term.isAsync,
          isGenerator: term.isGenerator,
          params: params,
          body: bodyTerm
        });
      case 'ArrowExpression':
        return new T.ArrowExpression({
          isAsync: term.isAsync,
          params: params,
          body: bodyTerm
        });
      case 'FunctionExpression':
        return new T.FunctionExpression({
          name: term.name,
          isAsync: term.isAsync,
          isGenerator: term.isGenerator,
          params: params,
          body: bodyTerm
        });
      case 'FunctionDeclaration':
        return new T.FunctionDeclaration({
          name: term.name,
          isAsync: term.isAsync,
          isGenerator: term.isGenerator,
          params: params,
          body: bodyTerm
        });
      default:
        throw new Error(`Unknown function type: ${type}`);
    }
  }

  expandMethod(term) {
    return this.doFunctionExpansion(term, 'Method');
  }

  expandSetter(term) {
    return this.doFunctionExpansion(term, 'Setter');
  }

  expandGetter(term) {
    return this.doFunctionExpansion(term, 'Getter');
  }

  expandFunctionDeclarationE(term) {
    return this.doFunctionExpansion(term, 'FunctionDeclaration');
  }

  expandFunctionExpressionE(term) {
    return this.doFunctionExpansion(term, 'FunctionExpression');
  }

  expandCompoundAssignmentExpression(term) {
    return new T.CompoundAssignmentExpression({
      binding: this.expand(term.binding),
      operator: term.operator,
      expression: this.expand(term.expression)
    });
  }

  expandAssignmentExpression(term) {
    return new T.AssignmentExpression({
      binding: this.expand(term.binding),
      expression: this.expand(term.expression)
    });
  }

  expandEmptyStatement(term) {
    return term;
  }

  expandLiteralBooleanExpression(term) {
    return term;
  }

  expandLiteralNumericExpression(term) {
    return term;
  }
  expandLiteralInfinityExpression(term) {
    return term;
  }

  expandIdentifierExpression(term) {
    let trans = this.context.env.get(term.name.resolve(this.context.phase));
    if (trans && trans.id) {
      return new T.IdentifierExpression({
        name: trans.id
      });
    }
    return term;
  }

  expandLiteralNullExpression(term) {
    return term;
  }

  expandLiteralStringExpression(term) {
    return term;
  }

  expandLiteralRegExpExpression(term) {
    return term;
  }
}
exports.default = TermExpander;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy90ZXJtLWV4cGFuZGVyLmpzIl0sIm5hbWVzIjpbIlQiLCJUZXJtRXhwYW5kZXIiLCJjb25zdHJ1Y3RvciIsImNvbnRleHQiLCJleHBhbmQiLCJ0ZXJtIiwiZGlzcGF0Y2giLCJleHBhbmRSYXdTeW50YXgiLCJleHBhbmRSYXdEZWxpbWl0ZXIiLCJleHBhbmRUZW1wbGF0ZUV4cHJlc3Npb24iLCJUZW1wbGF0ZUV4cHJlc3Npb24iLCJ0YWciLCJlbGVtZW50cyIsInRvQXJyYXkiLCJleHBhbmRCcmVha1N0YXRlbWVudCIsIkJyZWFrU3RhdGVtZW50IiwibGFiZWwiLCJ2YWwiLCJleHBhbmREb1doaWxlU3RhdGVtZW50IiwiRG9XaGlsZVN0YXRlbWVudCIsImJvZHkiLCJ0ZXN0IiwiZXhwYW5kV2l0aFN0YXRlbWVudCIsIldpdGhTdGF0ZW1lbnQiLCJvYmplY3QiLCJleHBhbmREZWJ1Z2dlclN0YXRlbWVudCIsImV4cGFuZENvbnRpbnVlU3RhdGVtZW50IiwiQ29udGludWVTdGF0ZW1lbnQiLCJleHBhbmRTd2l0Y2hTdGF0ZW1lbnRXaXRoRGVmYXVsdCIsIlN3aXRjaFN0YXRlbWVudFdpdGhEZWZhdWx0IiwiZGlzY3JpbWluYW50IiwicHJlRGVmYXVsdENhc2VzIiwibWFwIiwiYyIsImRlZmF1bHRDYXNlIiwicG9zdERlZmF1bHRDYXNlcyIsImV4cGFuZENvbXB1dGVkTWVtYmVyRXhwcmVzc2lvbiIsIkNvbXB1dGVkTWVtYmVyRXhwcmVzc2lvbiIsImV4cHJlc3Npb24iLCJleHBhbmRTd2l0Y2hTdGF0ZW1lbnQiLCJTd2l0Y2hTdGF0ZW1lbnQiLCJjYXNlcyIsImV4cGFuZEZvcm1hbFBhcmFtZXRlcnMiLCJyZXN0IiwiRm9ybWFsUGFyYW1ldGVycyIsIml0ZW1zIiwiaSIsImV4cGFuZEFycm93RXhwcmVzc2lvbkUiLCJkb0Z1bmN0aW9uRXhwYW5zaW9uIiwiZXhwYW5kQXJyb3dFeHByZXNzaW9uIiwiZXhwYW5kU3dpdGNoRGVmYXVsdCIsIlN3aXRjaERlZmF1bHQiLCJjb25zZXF1ZW50IiwiZXhwYW5kU3dpdGNoQ2FzZSIsIlN3aXRjaENhc2UiLCJleHBhbmRGb3JJblN0YXRlbWVudCIsIkZvckluU3RhdGVtZW50IiwibGVmdCIsInJpZ2h0IiwiZXhwYW5kVHJ5Q2F0Y2hTdGF0ZW1lbnQiLCJUcnlDYXRjaFN0YXRlbWVudCIsImNhdGNoQ2xhdXNlIiwiZXhwYW5kVHJ5RmluYWxseVN0YXRlbWVudCIsIlRyeUZpbmFsbHlTdGF0ZW1lbnQiLCJmaW5hbGl6ZXIiLCJleHBhbmRDYXRjaENsYXVzZSIsIkNhdGNoQ2xhdXNlIiwiYmluZGluZyIsImV4cGFuZFRocm93U3RhdGVtZW50IiwiVGhyb3dTdGF0ZW1lbnQiLCJleHBhbmRGb3JPZlN0YXRlbWVudCIsIkZvck9mU3RhdGVtZW50IiwiZXhwYW5kQmluZGluZ0lkZW50aWZpZXIiLCJleHBhbmRBc3NpZ25tZW50VGFyZ2V0SWRlbnRpZmllciIsImV4cGFuZEJpbmRpbmdQcm9wZXJ0eUlkZW50aWZpZXIiLCJleHBhbmRBc3NpZ25tZW50VGFyZ2V0UHJvcGVydHlJZGVudGlmaWVyIiwiZXhwYW5kQmluZGluZ1Byb3BlcnR5UHJvcGVydHkiLCJCaW5kaW5nUHJvcGVydHlQcm9wZXJ0eSIsIm5hbWUiLCJleHBhbmRBc3NpZ25tZW50VGFyZ2V0UHJvcGVydHlQcm9wZXJ0eSIsIkFzc2lnbm1lbnRUYXJnZXRQcm9wZXJ0eVByb3BlcnR5IiwiZXhwYW5kQ29tcHV0ZWRQcm9wZXJ0eU5hbWUiLCJDb21wdXRlZFByb3BlcnR5TmFtZSIsImV4cGFuZE9iamVjdEJpbmRpbmciLCJPYmplY3RCaW5kaW5nIiwicHJvcGVydGllcyIsInQiLCJleHBhbmRPYmplY3RBc3NpZ25tZW50VGFyZ2V0IiwiT2JqZWN0QXNzaWdubWVudFRhcmdldCIsImV4cGFuZEFycmF5QmluZGluZyIsIkFycmF5QmluZGluZyIsImV4cGFuZEFycmF5QXNzaWdubWVudFRhcmdldCIsIkFycmF5QXNzaWdubWVudFRhcmdldCIsImV4cGFuZEJpbmRpbmdXaXRoRGVmYXVsdCIsIkJpbmRpbmdXaXRoRGVmYXVsdCIsImluaXQiLCJleHBhbmRBc3NpZ25tZW50VGFyZ2V0V2l0aERlZmF1bHQiLCJBc3NpZ25tZW50VGFyZ2V0V2l0aERlZmF1bHQiLCJleHBhbmRTaG9ydGhhbmRQcm9wZXJ0eSIsIkRhdGFQcm9wZXJ0eSIsIlN0YXRpY1Byb3BlcnR5TmFtZSIsInZhbHVlIiwiSWRlbnRpZmllckV4cHJlc3Npb24iLCJleHBhbmRGb3JTdGF0ZW1lbnQiLCJ1cGRhdGUiLCJGb3JTdGF0ZW1lbnQiLCJleHBhbmRZaWVsZEV4cHJlc3Npb24iLCJleHByIiwiWWllbGRFeHByZXNzaW9uIiwiZXhwYW5kWWllbGRHZW5lcmF0b3JFeHByZXNzaW9uIiwiWWllbGRHZW5lcmF0b3JFeHByZXNzaW9uIiwiZXhwYW5kV2hpbGVTdGF0ZW1lbnQiLCJXaGlsZVN0YXRlbWVudCIsImV4cGFuZElmU3RhdGVtZW50IiwiYWx0ZXJuYXRlIiwiSWZTdGF0ZW1lbnQiLCJleHBhbmRCbG9ja1N0YXRlbWVudCIsIkJsb2NrU3RhdGVtZW50IiwiYmxvY2siLCJleHBhbmRCbG9jayIsInNjb3BlIiwiY3VycmVudFNjb3BlIiwicHVzaCIsImNvbXBpbGVyIiwicGhhc2UiLCJlbnYiLCJzdG9yZSIsIm1hcmtlZEJvZHkiLCJib2R5VGVybSIsInN0YXRlbWVudHMiLCJiIiwicmVkdWNlIiwiZmxpcCIsImJpbmRpbmdzIiwiQmxvY2siLCJjb21waWxlIiwicG9wIiwiZXhwYW5kVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudCIsIlZhcmlhYmxlRGVjbGFyYXRpb25TdGF0ZW1lbnQiLCJkZWNsYXJhdGlvbiIsImV4cGFuZFJldHVyblN0YXRlbWVudCIsIlJldHVyblN0YXRlbWVudCIsImV4cGFuZENsYXNzRGVjbGFyYXRpb24iLCJDbGFzc0RlY2xhcmF0aW9uIiwic3VwZXIiLCJlbCIsImV4cGFuZENsYXNzRXhwcmVzc2lvbiIsIkNsYXNzRXhwcmVzc2lvbiIsImV4cGFuZENsYXNzRWxlbWVudCIsIkNsYXNzRWxlbWVudCIsImlzU3RhdGljIiwibWV0aG9kIiwiZXhwYW5kVGhpc0V4cHJlc3Npb24iLCJleHBhbmRTeW50YXhUZW1wbGF0ZSIsInIiLCJ0ZW1wbGF0ZSIsInNsaWNlIiwic2l6ZSIsImlkZW50IiwiZ2V0VGVtcGxhdGVJZGVudGlmaWVyIiwidGVtcGxhdGVNYXAiLCJzZXQiLCJmcm9tSWRlbnRpZmllciIsImZpcnN0IiwiY2FsbGVlIiwiZXhwYW5kZWRJbnRlcnBzIiwiaW50ZXJwIiwiZW5mIiwiZW5mb3Jlc3QiLCJhcmdzIiwib2YiLCJMaXRlcmFsTnVtZXJpY0V4cHJlc3Npb24iLCJjb25jYXQiLCJDYWxsRXhwcmVzc2lvbiIsImFyZ3VtZW50cyIsImV4cGFuZFN0YXRpY01lbWJlckV4cHJlc3Npb24iLCJTdGF0aWNNZW1iZXJFeHByZXNzaW9uIiwicHJvcGVydHkiLCJleHBhbmRTdGF0aWNNZW1iZXJBc3NpZ25tZW50VGFyZ2V0IiwiU3RhdGljTWVtYmVyQXNzaWdubWVudFRhcmdldCIsImV4cGFuZENvbXB1dGVkTWVtYmVyQXNzaWdubWVudFRhcmdldCIsIkNvbXB1dGVkTWVtYmVyQXNzaWdubWVudFRhcmdldCIsImV4cGFuZEFycmF5RXhwcmVzc2lvbiIsIkFycmF5RXhwcmVzc2lvbiIsImV4cGFuZEltcG9ydCIsImV4cGFuZEltcG9ydE5hbWVzcGFjZSIsImV4cGFuZEV4cG9ydCIsIkV4cG9ydCIsImV4cGFuZEV4cG9ydERlZmF1bHQiLCJFeHBvcnREZWZhdWx0IiwiZXhwYW5kRXhwb3J0RnJvbSIsImV4cGFuZEV4cG9ydExvY2FscyIsImV4cGFuZEV4cG9ydEFsbEZyb20iLCJleHBhbmRFeHBvcnRGcm9tU3BlY2lmaWVyIiwiZXhwYW5kRXhwb3J0TG9jYWxTcGVjaWZpZXIiLCJleHBhbmRTdGF0aWNQcm9wZXJ0eU5hbWUiLCJleHBhbmREYXRhUHJvcGVydHkiLCJleHBhbmRPYmplY3RFeHByZXNzaW9uIiwiT2JqZWN0RXhwcmVzc2lvbiIsImV4cGFuZFZhcmlhYmxlRGVjbGFyYXRvciIsIlZhcmlhYmxlRGVjbGFyYXRvciIsImV4cGFuZFZhcmlhYmxlRGVjbGFyYXRpb24iLCJraW5kIiwiVmFyaWFibGVEZWNsYXJhdGlvbiIsImRlY2xhcmF0b3JzIiwiZCIsImV4cGFuZFBhcmVudGhlc2l6ZWRFeHByZXNzaW9uIiwiaW5uZXIiLCJFcnJvciIsImxvb2thaGVhZCIsInBlZWsiLCJlbmZvcmVzdEV4cHJlc3Npb24iLCJjcmVhdGVFcnJvciIsImV4cGFuZFVuYXJ5RXhwcmVzc2lvbiIsIm9wZXJhdG9yIiwiQXdhaXRFeHByZXNzaW9uIiwib3BlcmFuZCIsIlVuYXJ5RXhwcmVzc2lvbiIsImV4cGFuZFVwZGF0ZUV4cHJlc3Npb24iLCJVcGRhdGVFeHByZXNzaW9uIiwiaXNQcmVmaXgiLCJleHBhbmRCaW5hcnlFeHByZXNzaW9uIiwiQmluYXJ5RXhwcmVzc2lvbiIsImV4cGFuZENvbmRpdGlvbmFsRXhwcmVzc2lvbiIsIkNvbmRpdGlvbmFsRXhwcmVzc2lvbiIsImV4cGFuZE5ld1RhcmdldEV4cHJlc3Npb24iLCJleHBhbmROZXdFeHByZXNzaW9uIiwiZW5mb3Jlc3RBcmd1bWVudExpc3QiLCJhcmciLCJOZXdFeHByZXNzaW9uIiwiZXhwYW5kU3VwZXIiLCJleHBhbmRDYWxsRXhwcmVzc2lvbkUiLCJleHBhbmRTcHJlYWRFbGVtZW50IiwiU3ByZWFkRWxlbWVudCIsImV4cGFuZEV4cHJlc3Npb25TdGF0ZW1lbnQiLCJjaGlsZCIsIkV4cHJlc3Npb25TdGF0ZW1lbnQiLCJleHBhbmRMYWJlbGVkU3RhdGVtZW50IiwiTGFiZWxlZFN0YXRlbWVudCIsInR5cGUiLCJwYXJhbXMiLCJzZWxmIiwiQ2xvbmVSZWR1Y2VyIiwicmVkdWNlQmluZGluZ0lkZW50aWZpZXIiLCJhZGRTY29wZSIsIm5ld0JpbmRpbmciLCJ0b1N0cmluZyIsImFkZCIsInNraXBEdXAiLCJCaW5kaW5nSWRlbnRpZmllciIsIk9iamVjdCIsImFzc2lnbiIsImFsbG93QXdhaXQiLCJpc0FzeW5jIiwic2NvcGVSZWR1Y2VyIiwiY29tcGlsZWRCb2R5IiwiZGlyZWN0aXZlcyIsInRha2VXaGlsZSIsInMiLCJEaXJlY3RpdmUiLCJyYXdWYWx1ZSIsIkZ1bmN0aW9uQm9keSIsIkdldHRlciIsIlNldHRlciIsInBhcmFtIiwiTWV0aG9kIiwiaXNHZW5lcmF0b3IiLCJBcnJvd0V4cHJlc3Npb24iLCJGdW5jdGlvbkV4cHJlc3Npb24iLCJGdW5jdGlvbkRlY2xhcmF0aW9uIiwiZXhwYW5kTWV0aG9kIiwiZXhwYW5kU2V0dGVyIiwiZXhwYW5kR2V0dGVyIiwiZXhwYW5kRnVuY3Rpb25EZWNsYXJhdGlvbkUiLCJleHBhbmRGdW5jdGlvbkV4cHJlc3Npb25FIiwiZXhwYW5kQ29tcG91bmRBc3NpZ25tZW50RXhwcmVzc2lvbiIsIkNvbXBvdW5kQXNzaWdubWVudEV4cHJlc3Npb24iLCJleHBhbmRBc3NpZ25tZW50RXhwcmVzc2lvbiIsIkFzc2lnbm1lbnRFeHByZXNzaW9uIiwiZXhwYW5kRW1wdHlTdGF0ZW1lbnQiLCJleHBhbmRMaXRlcmFsQm9vbGVhbkV4cHJlc3Npb24iLCJleHBhbmRMaXRlcmFsTnVtZXJpY0V4cHJlc3Npb24iLCJleHBhbmRMaXRlcmFsSW5maW5pdHlFeHByZXNzaW9uIiwiZXhwYW5kSWRlbnRpZmllckV4cHJlc3Npb24iLCJ0cmFucyIsImdldCIsInJlc29sdmUiLCJpZCIsImV4cGFuZExpdGVyYWxOdWxsRXhwcmVzc2lvbiIsImV4cGFuZExpdGVyYWxTdHJpbmdFeHByZXNzaW9uIiwiZXhwYW5kTGl0ZXJhbFJlZ0V4cEV4cHJlc3Npb24iXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOztBQUNBOztBQUNBOztJQUFrQkEsQzs7QUFDbEI7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOztBQUNBOztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7QUFDQTs7Ozs7O0FBR2UsTUFBTUMsWUFBTixpQ0FBeUM7QUFDdERDLGNBQVlDLE9BQVosRUFBcUI7QUFDbkIsVUFBTSxRQUFOLEVBQWdCLElBQWhCO0FBQ0EsU0FBS0EsT0FBTCxH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OztBQUVENFIsZ0NBQThCNVIsSUFBOUIsRUFBb0M7QUFDbEMsV0FBT0EsSUFBUDtBQUNEOztBQUVENlIsZ0NBQThCN1IsSUFBOUIsRUFBb0M7QUFDbEMsV0FBT0EsSUFBUDtBQUNEO0FBMXdCcUQ7a0JBQW5DSixZIiwiZmlsZSI6InRlcm0tZXhwYW5kZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMaXN0IH0gZnJvbSAnaW1tdXRhYmxlJztcbmltcG9ydCB7IGlzRXhwcmVzc2lvblN0YXRlbWVudCwgaXNMaXRlcmFsU3RyaW5nRXhwcmVzc2lvbiB9IGZyb20gJy4vdGVybXMnO1xuaW1wb3J0IFRlcm0sICogYXMgVCBmcm9tICdzd2VldC1zcGVjJztcbmltcG9ydCB7IGZyZXNoU2NvcGUgfSBmcm9tICcuL3Njb3BlJztcbmltcG9ydCBDb21waWxlciBmcm9tICcuL2NvbXBpbGVyJztcbmltcG9ydCB7IEFMTF9QSEFTRVMgfSBmcm9tICcuL3N5bnRheCc7XG5pbXBvcnQgeyBFbmZvcmVzdGVyIH0gZnJvbSAnLi9lbmZvcmVzdGVyJztcbmltcG9ydCB7IHByb2Nlc3NUZW1wbGF0ZSB9IGZyb20gJy4vdGVtcGxhdGUtcHJvY2Vzc29yJztcbmltcG9ydCBBU1REaXNwYXRjaGVyIGZyb20gJy4vYXN0LWRpc3BhdGNoZXInO1xuaW1wb3J0IFNjb3BlUmVkdWNlciBmcm9tICcuL3Njb3BlLXJlZHVjZXInO1xuaW1wb3J0IHsgZ2Vuc3ltIH0gZnJvbSAnLi9zeW1ib2wnO1xuaW1wb3J0IHsgVmFyQmluZGluZ1RyYW5zZm9ybSB9IGZyb20gJy4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgU3ludGF4IGZyb20gJy4vc3ludGF4JztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGVybUV4cGFuZGVyIGV4dGVuZHMgQVNURGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKGNvbnRleHQpIHtcbiAgICBzdXBlcignZXhwYW5kJywgdHJ1ZSk7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgfVxuXG4gIGV4cGFuZCh0ZXJtKSB7XG4gICAgcmV0dXJuIHRoaXMuZGlzcGF0Y2godGVybSk7XG4gIH1cblxuICBleHBhbmRSYXdTeW50YXgodGVybSkge1xuICAgIHJldHVybiB0ZXJtO1xuICB9XG5cbiAgZXhwYW5kUmF3RGVsaW1pdGVyKHRlcm0pIHtcbiAgICByZXR1cm4gdGVybTtcbiAgfVxuXG4gIGV4cGFuZFRlbXBsYXRlRXhwcmVzc2lvbih0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULlRlbXBsYXRlRXhwcmVzc2lvbih7XG4gICAgICB0YWc6IHRlcm0udGFnID09IG51bGwgPyBudWxsIDogdGhpcy5leHBhbmQodGVybS50YWcpLFxuICAgICAgZWxlbWVudHM6IHRlcm0uZWxlbWVudHMudG9BcnJheSgpLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kQnJlYWtTdGF0ZW1lbnQodGVybSkge1xuICAgIHJldHVybiBuZXcgVC5CcmVha1N0YXRlbWVudCh7XG4gICAgICBsYWJlbDogdGVybS5sYWJlbCA/IHRlcm0ubGFiZWwudmFsKCkgOiBudWxsLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kRG9XaGlsZVN0YXRlbWVudCh0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULkRvV2hpbGVTdGF0ZW1lbnQoe1xuICAgICAgYm9keTogdGhpcy5leHBhbmQodGVybS5ib2R5KSxcbiAgICAgIHRlc3Q6IHRoaXMuZXhwYW5kKHRlcm0udGVzdCksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRXaXRoU3RhdGVtZW50KHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuV2l0aFN0YXRlbWVudCh7XG4gICAgICBib2R5OiB0aGlzLmV4cGFuZCh0ZXJtLmJvZHkpLFxuICAgICAgb2JqZWN0OiB0aGlzLmV4cGFuZCh0ZXJtLm9iamVjdCksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmREZWJ1Z2dlclN0YXRlbWVudCh0ZXJtKSB7XG4gICAgcmV0dXJuIHRlcm07XG4gIH1cblxuICBleHBhbmRDb250aW51ZVN0YXRlbWVudCh0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULkNvbnRpbnVlU3RhdGVtZW50KHtcbiAgICAgIGxhYmVsOiB0ZXJtLmxhYmVsID8gdGVybS5sYWJlbC52YWwoKSA6IG51bGwsXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRTd2l0Y2hTdGF0ZW1lbnRXaXRoRGVmYXVsdCh0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULlN3aXRjaFN0YXRlbWVudFdpdGhEZWZhdWx0KHtcbiAgICAgIGRpc2NyaW1pbmFudDogdGhpcy5leHBhbmQodGVybS5kaXNjcmltaW5hbnQpLFxuICAgICAgcHJlRGVmYXVsdENhc2VzOiB0ZXJtLnByZURlZmF1bHRDYXNlcy5tYXAoYyA9PiB0aGlzLmV4cGFuZChjKSkudG9BcnJheSgpLFxuICAgICAgZGVmYXVsdENhc2U6IHRoaXMuZXhwYW5kKHRlcm0uZGVmYXVsdENhc2UpLFxuICAgICAgcG9zdERlZmF1bHRDYXNlczogdGVybS5wb3N0RGVmYXVsdENhc2VzXG4gICAgICAgIC5tYXAoYyA9PiB0aGlzLmV4cGFuZChjKSlcbiAgICAgICAgLnRvQXJyYXkoKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZENvbXB1dGVkTWVtYmVyRXhwcmVzc2lvbih0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULkNvbXB1dGVkTWVtYmVyRXhwcmVzc2lvbih7XG4gICAgICBvYmplY3Q6IHRoaXMuZXhwYW5kKHRlcm0ub2JqZWN0KSxcbiAgICAgIGV4cHJlc3Npb246IHRoaXMuZXhwYW5kKHRlcm0uZXhwcmVzc2lvbiksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRTd2l0Y2hTdGF0ZW1lbnQodGVybSkge1xuICAgIHJldHVybiBuZXcgVC5Td2l0Y2hTdGF0ZW1lbnQoe1xuICAgICAgZGlzY3JpbWluYW50OiB0aGlzLmV4cGFuZCh0ZXJtLmRpc2NyaW1pbmFudCksXG4gICAgICBjYXNlczogdGVybS5jYXNlcy5tYXAoYyA9PiB0aGlzLmV4cGFuZChjKSkudG9BcnJheSgpLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kRm9ybWFsUGFyYW1ldGVycyh0ZXJtKSB7XG4gICAgbGV0IHJlc3QgPSB0ZXJtLnJlc3QgPT0gbnVsbCA/IG51bGwgOiB0aGlzLmV4cGFuZCh0ZXJtLnJlc3QpO1xuICAgIHJldHVybiBuZXcgVC5Gb3JtYWxQYXJhbWV0ZXJzKHtcbiAgICAgIGl0ZW1zOiB0ZXJtLml0ZW1zLm1hcChpID0+IHRoaXMuZXhwYW5kKGkpKSxcbiAgICAgIHJlc3QsXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRBcnJvd0V4cHJlc3Npb25FKHRlcm0pIHtcbiAgICByZXR1cm4gdGhpcy5kb0Z1bmN0aW9uRXhwYW5zaW9uKHRlcm0sICdBcnJvd0V4cHJlc3Npb24nKTtcbiAgfVxuXG4gIGV4cGFuZEFycm93RXhwcmVzc2lvbih0ZXJtKSB7XG4gICAgcmV0dXJuIHRoaXMuZG9GdW5jdGlvbkV4cGFuc2lvbih0ZXJtLCAnQXJyb3dFeHByZXNzaW9uJyk7XG4gIH1cblxuICBleHBhbmRTd2l0Y2hEZWZhdWx0KHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuU3dpdGNoRGVmYXVsdCh7XG4gICAgICBjb25zZXF1ZW50OiB0ZXJtLmNvbnNlcXVlbnQubWFwKGMgPT4gdGhpcy5leHBhbmQoYykpLnRvQXJyYXkoKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZFN3aXRjaENhc2UodGVybSkge1xuICAgIHJldHVybiBuZXcgVC5Td2l0Y2hDYXNlKHtcbiAgICAgIHRlc3Q6IHRoaXMuZXhwYW5kKHRlcm0udGVzdCksXG4gICAgICBjb25zZXF1ZW50OiB0ZXJtLmNvbnNlcXVlbnQubWFwKGMgPT4gdGhpcy5leHBhbmQoYykpLnRvQXJyYXkoKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZEZvckluU3RhdGVtZW50KHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuRm9ySW5TdGF0ZW1lbnQoe1xuICAgICAgbGVmdDogdGhpcy5leHBhbmQodGVybS5sZWZ0KSxcbiAgICAgIHJpZ2h0OiB0aGlzLmV4cGFuZCh0ZXJtLnJpZ2h0KSxcbiAgICAgIGJvZHk6IHRoaXMuZXhwYW5kKHRlcm0uYm9keSksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRUcnlDYXRjaFN0YXRlbWVudCh0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULlRyeUNhdGNoU3RhdGVtZW50KHtcbiAgICAgIGJvZHk6IHRoaXMuZXhwYW5kKHRlcm0uYm9keSksXG4gICAgICBjYXRjaENsYXVzZTogdGhpcy5leHBhbmQodGVybS5jYXRjaENsYXVzZSksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRUcnlGaW5hbGx5U3RhdGVtZW50KHRlcm0pIHtcbiAgICBsZXQgY2F0Y2hDbGF1c2UgPVxuICAgICAgdGVybS5jYXRjaENsYXVzZSA9PSBudWxsID8gbnVsbCA6IHRoaXMuZXhwYW5kKHRlcm0uY2F0Y2hDbGF1c2UpO1xuICAgIHJldHVybiBuZXcgVC5UcnlGaW5hbGx5U3RhdGVtZW50KHtcbiAgICAgIGJvZHk6IHRoaXMuZXhwYW5kKHRlcm0uYm9keSksXG4gICAgICBjYXRjaENsYXVzZSxcbiAgICAgIGZpbmFsaXplcjogdGhpcy5leHBhbmQodGVybS5maW5hbGl6ZXIpLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kQ2F0Y2hDbGF1c2UodGVybSkge1xuICAgIHJldHVybiBuZXcgVC5DYXRjaENsYXVzZSh7XG4gICAgICBiaW5kaW5nOiB0aGlzLmV4cGFuZCh0ZXJtLmJpbmRpbmcpLFxuICAgICAgYm9keTogdGhpcy5leHBhbmQodGVybS5ib2R5KSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZFRocm93U3RhdGVtZW50KHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuVGhyb3dTdGF0ZW1lbnQoe1xuICAgICAgZXhwcmVzc2lvbjogdGhpcy5leHBhbmQodGVybS5leHByZXNzaW9uKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZEZvck9mU3RhdGVtZW50KHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuRm9yT2ZTdGF0ZW1lbnQoe1xuICAgICAgbGVmdDogdGhpcy5leHBhbmQodGVybS5sZWZ0KSxcbiAgICAgIHJpZ2h0OiB0aGlzLmV4cGFuZCh0ZXJtLnJpZ2h0KSxcbiAgICAgIGJvZHk6IHRoaXMuZXhwYW5kKHRlcm0uYm9keSksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRCaW5kaW5nSWRlbnRpZmllcih0ZXJtKSB7XG4gICAgcmV0dXJuIHRlcm07XG4gIH1cblxuICBleHBhbmRBc3NpZ25tZW50VGFyZ2V0SWRlbnRpZmllcih0ZXJtKSB7XG4gICAgcmV0dXJuIHRlcm07XG4gIH1cblxuICBleHBhbmRCaW5kaW5nUHJvcGVydHlJZGVudGlmaWVyKHRlcm0pIHtcbiAgICByZXR1cm4gdGVybTtcbiAgfVxuXG4gIGV4cGFuZEFzc2lnbm1lbnRUYXJnZXRQcm9wZXJ0eUlkZW50aWZpZXIodGVybSkge1xuICAgIHJldHVybiB0ZXJtO1xuICB9XG5cbiAgZXhwYW5kQmluZGluZ1Byb3BlcnR5UHJvcGVydHkodGVybSkge1xuICAgIHJldHVybiBuZXcgVC5CaW5kaW5nUHJvcGVydHlQcm9wZXJ0eSh7XG4gICAgICBuYW1lOiB0aGlzLmV4cGFuZCh0ZXJtLm5hbWUpLFxuICAgICAgYmluZGluZzogdGhpcy5leHBhbmQodGVybS5iaW5kaW5nKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZEFzc2lnbm1lbnRUYXJnZXRQcm9wZXJ0eVByb3BlcnR5KHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuQXNzaWdubWVudFRhcmdldFByb3BlcnR5UHJvcGVydHkoe1xuICAgICAgbmFtZTogdGhpcy5leHBhbmQodGVybS5uYW1lKSxcbiAgICAgIGJpbmRpbmc6IHRoaXMuZXhwYW5kKHRlcm0uYmluZGluZyksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRDb21wdXRlZFByb3BlcnR5TmFtZSh0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULkNvbXB1dGVkUHJvcGVydHlOYW1lKHtcbiAgICAgIGV4cHJlc3Npb246IHRoaXMuZXhwYW5kKHRlcm0uZXhwcmVzc2lvbiksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRPYmplY3RCaW5kaW5nKHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuT2JqZWN0QmluZGluZyh7XG4gICAgICBwcm9wZXJ0aWVzOiB0ZXJtLnByb3BlcnRpZXMubWFwKHQgPT4gdGhpcy5leHBhbmQodCkpLnRvQXJyYXkoKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZE9iamVjdEFzc2lnbm1lbnRUYXJnZXQodGVybSkge1xuICAgIHJldHVybiBuZXcgVC5PYmplY3RBc3NpZ25tZW50VGFyZ2V0KHtcbiAgICAgIHByb3BlcnRpZXM6IHRlcm0ucHJvcGVydGllcy5tYXAodCA9PiB0aGlzLmV4cGFuZCh0KSkudG9BcnJheSgpLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kQXJyYXlCaW5kaW5nKHRlcm0pIHtcbiAgICBsZXQgcmVzdCA9IHRlcm0ucmVzdCA9PSBudWxsID8gbnVsbCA6IHRoaXMuZXhwYW5kKHRlcm0ucmVzdCk7XG4gICAgcmV0dXJuIG5ldyBULkFycmF5QmluZGluZyh7XG4gICAgICBlbGVtZW50czogdGVybS5lbGVtZW50c1xuICAgICAgICAubWFwKHQgPT4gKHQgPT0gbnVsbCA/IG51bGwgOiB0aGlzLmV4cGFuZCh0KSkpXG4gICAgICAgIC50b0FycmF5KCksXG4gICAgICByZXN0LFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kQXJyYXlBc3NpZ25tZW50VGFyZ2V0KHRlcm0pIHtcbiAgICBsZXQgcmVzdCA9IHRlcm0ucmVzdCA9PSBudWxsID8gbnVsbCA6IHRoaXMuZXhwYW5kKHRlcm0ucmVzdCk7XG4gICAgcmV0dXJuIG5ldyBULkFycmF5QXNzaWdubWVudFRhcmdldCh7XG4gICAgICBlbGVtZW50czogdGVybS5lbGVtZW50c1xuICAgICAgICAubWFwKHQgPT4gKHQgPT0gbnVsbCA/IG51bGwgOiB0aGlzLmV4cGFuZCh0KSkpXG4gICAgICAgIC50b0FycmF5KCksXG4gICAgICByZXN0LFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kQmluZGluZ1dpdGhEZWZhdWx0KHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuQmluZGluZ1dpdGhEZWZhdWx0KHtcbiAgICAgIGJpbmRpbmc6IHRoaXMuZXhwYW5kKHRlcm0uYmluZGluZyksXG4gICAgICBpbml0OiB0aGlzLmV4cGFuZCh0ZXJtLmluaXQpLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kQXNzaWdubWVudFRhcmdldFdpdGhEZWZhdWx0KHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuQXNzaWdubWVudFRhcmdldFdpdGhEZWZhdWx0KHtcbiAgICAgIGJpbmRpbmc6IHRoaXMuZXhwYW5kKHRlcm0uYmluZGluZyksXG4gICAgICBpbml0OiB0aGlzLmV4cGFuZCh0ZXJtLmluaXQpLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kU2hvcnRoYW5kUHJvcGVydHkodGVybSkge1xuICAgIC8vIGJlY2F1c2UgaHlnaWVuZSwgc2hvcnRoYW5kIHByb3BlcnRpZXMgbXVzdCB0dXJuIGludG8gRGF0YVByb3BlcnRpZXNcbiAgICByZXR1cm4gbmV3IFQuRGF0YVByb3BlcnR5KHtcbiAgICAgIG5hbWU6IG5ldyBULlN0YXRpY1Byb3BlcnR5TmFtZSh7XG4gICAgICAgIHZhbHVlOiB0ZXJtLm5hbWUsXG4gICAgICB9KSxcbiAgICAgIGV4cHJlc3Npb246IG5ldyBULklkZW50aWZpZXJFeHByZXNzaW9uKHtcbiAgICAgICAgbmFtZTogdGVybS5uYW1lLFxuICAgICAgfSksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRGb3JTdGF0ZW1lbnQodGVybSkge1xuICAgIGxldCBpbml0ID0gdGVybS5pbml0ID09IG51bGwgPyBudWxsIDogdGhpcy5leHBhbmQodGVybS5pbml0KTtcbiAgICBsZXQgdGVzdCA9IHRlcm0udGVzdCA9PSBudWxsID8gbnVsbCA6IHRoaXMuZXhwYW5kKHRlcm0udGVzdCk7XG4gICAgbGV0IHVwZGF0ZSA9IHRlcm0udXBkYXRlID09IG51bGwgPyBudWxsIDogdGhpcy5leHBhbmQodGVybS51cGRhdGUpO1xuICAgIGxldCBib2R5ID0gdGhpcy5leHBhbmQodGVybS5ib2R5KTtcbiAgICByZXR1cm4gbmV3IFQuRm9yU3RhdGVtZW50KHsgaW5pdCwgdGVzdCwgdXBkYXRlLCBib2R5IH0pO1xuICB9XG5cbiAgZXhwYW5kWWllbGRFeHByZXNzaW9uKHRlcm0pIHtcbiAgICBsZXQgZXhwciA9IHRlcm0uZXhwcmVzc2lvbiA9PSBudWxsID8gbnVsbCA6IHRoaXMuZXhwYW5kKHRlcm0uZXhwcmVzc2lvbik7XG4gICAgcmV0dXJuIG5ldyBULllpZWxkRXhwcmVzc2lvbih7XG4gICAgICBleHByZXNzaW9uOiBleHByLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kWWllbGRHZW5lcmF0b3JFeHByZXNzaW9uKHRlcm0pIHtcbiAgICBsZXQgZXhwciA9IHRlcm0uZXhwcmVzc2lvbiA9PSBudWxsID8gbnVsbCA6IHRoaXMuZXhwYW5kKHRlcm0uZXhwcmVzc2lvbik7XG4gICAgcmV0dXJuIG5ldyBULllpZWxkR2VuZXJhdG9yRXhwcmVzc2lvbih7XG4gICAgICBleHByZXNzaW9uOiBleHByLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kV2hpbGVTdGF0ZW1lbnQodGVybSkge1xuICAgIHJldHVybiBuZXcgVC5XaGlsZVN0YXRlbWVudCh7XG4gICAgICB0ZXN0OiB0aGlzLmV4cGFuZCh0ZXJtLnRlc3QpLFxuICAgICAgYm9keTogdGhpcy5leHBhbmQodGVybS5ib2R5KSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZElmU3RhdGVtZW50KHRlcm0pIHtcbiAgICBsZXQgY29uc2VxdWVudCA9XG4gICAgICB0ZXJtLmNvbnNlcXVlbnQgPT0gbnVsbCA/IG51bGwgOiB0aGlzLmV4cGFuZCh0ZXJtLmNvbnNlcXVlbnQpO1xuICAgIGxldCBhbHRlcm5hdGUgPSB0ZXJtLmFsdGVybmF0ZSA9PSBudWxsID8gbnVsbCA6IHRoaXMuZXhwYW5kKHRlcm0uYWx0ZXJuYXRlKTtcbiAgICByZXR1cm4gbmV3IFQuSWZTdGF0ZW1lbnQoe1xuICAgICAgdGVzdDogdGhpcy5leHBhbmQodGVybS50ZXN0KSxcbiAgICAgIGNvbnNlcXVlbnQ6IGNvbnNlcXVlbnQsXG4gICAgICBhbHRlcm5hdGU6IGFsdGVybmF0ZSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZEJsb2NrU3RhdGVtZW50KHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuQmxvY2tTdGF0ZW1lbnQoe1xuICAgICAgYmxvY2s6IHRoaXMuZXhwYW5kKHRlcm0uYmxvY2spLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kQmxvY2sodGVybSkge1xuICAgIGxldCBzY29wZSA9IGZyZXNoU2NvcGUoJ2Jsb2NrJyk7XG4gICAgdGhpcy5jb250ZXh0LmN1cnJlbnRTY29wZS5wdXNoKHNjb3BlKTtcbiAgICBsZXQgY29tcGlsZXIgPSBuZXcgQ29tcGlsZXIoXG4gICAgICB0aGlzLmNvbnRleHQucGhhc2UsXG4gICAgICB0aGlzLmNvbnRleHQuZW52LFxuICAgICAgdGhpcy5jb250ZXh0LnN0b3JlLFxuICAgICAgdGhpcy5jb250ZXh0LFxuICAgICk7XG5cbiAgICBsZXQgbWFya2VkQm9keSwgYm9keVRlcm07XG4gICAgbWFya2VkQm9keSA9IHRlcm0uc3RhdGVtZW50cy5tYXAoYiA9PlxuICAgICAgYi5yZWR1Y2UoXG4gICAgICAgIG5ldyBTY29wZVJlZHVjZXIoXG4gICAgICAgICAgW3sgc2NvcGUsIHBoYXNlOiBBTExfUEhBU0VTLCBmbGlwOiBmYWxzZSB9XSxcbiAgICAgICAgICB0aGlzLmNvbnRleHQuYmluZGluZ3MsXG4gICAgICAgICksXG4gICAgICApLFxuICAgICk7XG4gICAgYm9keVRlcm0gPSBuZXcgVC5CbG9jayh7XG4gICAgICBzdGF0ZW1lbnRzOiBjb21waWxlci5jb21waWxlKG1hcmtlZEJvZHkpLFxuICAgIH0pO1xuICAgIHRoaXMuY29udGV4dC5jdXJyZW50U2NvcGUucG9wKCk7XG4gICAgcmV0dXJuIGJvZHlUZXJtO1xuICB9XG5cbiAgZXhwYW5kVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudCh0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULlZhcmlhYmxlRGVjbGFyYXRpb25TdGF0ZW1lbnQoe1xuICAgICAgZGVjbGFyYXRpb246IHRoaXMuZXhwYW5kKHRlcm0uZGVjbGFyYXRpb24pLFxuICAgIH0pO1xuICB9XG4gIGV4cGFuZFJldHVyblN0YXRlbWVudCh0ZXJtKSB7XG4gICAgaWYgKHRlcm0uZXhwcmVzc2lvbiA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdGVybTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBULlJldHVyblN0YXRlbWVudCh7XG4gICAgICBleHByZXNzaW9uOiB0aGlzLmV4cGFuZCh0ZXJtLmV4cHJlc3Npb24pLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kQ2xhc3NEZWNsYXJhdGlvbih0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULkNsYXNzRGVjbGFyYXRpb24oe1xuICAgICAgbmFtZTogdGVybS5uYW1lID09IG51bGwgPyBudWxsIDogdGhpcy5leHBhbmQodGVybS5uYW1lKSxcbiAgICAgIHN1cGVyOiB0ZXJtLnN1cGVyID09IG51bGwgPyBudWxsIDogdGhpcy5leHBhbmQodGVybS5zdXBlciksXG4gICAgICBlbGVtZW50czogdGVybS5lbGVtZW50cy5tYXAoZWwgPT4gdGhpcy5leHBhbmQoZWwpKS50b0FycmF5KCksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRDbGFzc0V4cHJlc3Npb24odGVybSkge1xuICAgIHJldHVybiBuZXcgVC5DbGFzc0V4cHJlc3Npb24oe1xuICAgICAgbmFtZTogdGVybS5uYW1lID09IG51bGwgPyBudWxsIDogdGhpcy5leHBhbmQodGVybS5uYW1lKSxcbiAgICAgIHN1cGVyOiB0ZXJtLnN1cGVyID09IG51bGwgPyBudWxsIDogdGhpcy5leHBhbmQodGVybS5zdXBlciksXG4gICAgICBlbGVtZW50czogdGVybS5lbGVtZW50cy5tYXAoZWwgPT4gdGhpcy5leHBhbmQoZWwpKS50b0FycmF5KCksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRDbGFzc0VsZW1lbnQodGVybSkge1xuICAgIHJldHVybiBuZXcgVC5DbGFzc0VsZW1lbnQoe1xuICAgICAgaXNTdGF0aWM6IHRlcm0uaXNTdGF0aWMsXG4gICAgICBtZXRob2Q6IHRoaXMuZXhwYW5kKHRlcm0ubWV0aG9kKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZFRoaXNFeHByZXNzaW9uKHRlcm0pIHtcbiAgICByZXR1cm4gdGVybTtcbiAgfVxuXG4gIGV4cGFuZFN5bnRheFRlbXBsYXRlKHRlcm0pIHtcbiAgICBsZXQgciA9IHByb2Nlc3NUZW1wbGF0ZSh0ZXJtLnRlbXBsYXRlLnNsaWNlKDEsIHRlcm0udGVtcGxhdGUuc2l6ZSAtIDEpKTtcbiAgICBsZXQgaWRlbnQgPSB0aGlzLmNvbnRleHQuZ2V0VGVtcGxhdGVJZGVudGlmaWVyKCk7XG4gICAgdGhpcy5jb250ZXh0LnRlbXBsYXRlTWFwLnNldChpZGVudCwgci50ZW1wbGF0ZSk7XG4gICAgbGV0IG5hbWUgPSBTeW50YXguZnJvbUlkZW50aWZpZXIoXG4gICAgICAnc3ludGF4VGVtcGxhdGUnLFxuICAgICAgdGVybS50ZW1wbGF0ZS5maXJzdCgpLnZhbHVlLFxuICAgICk7XG4gICAgbGV0IGNhbGxlZSA9IG5ldyBULklkZW50aWZpZXJFeHByZXNzaW9uKHtcbiAgICAgIG5hbWU6IG5hbWUsXG4gICAgfSk7XG5cbiAgICBsZXQgZXhwYW5kZWRJbnRlcnBzID0gci5pbnRlcnAubWFwKGkgPT4ge1xuICAgICAgbGV0IGVuZiA9IG5ldyBFbmZvcmVzdGVyKGksIExpc3QoKSwgdGhpcy5jb250ZXh0KTtcbiAgICAgIHJldHVybiB0aGlzLmV4cGFuZChlbmYuZW5mb3Jlc3QoJ2V4cHJlc3Npb24nKSk7XG4gICAgfSk7XG5cbiAgICBsZXQgYXJncyA9IExpc3Qub2YobmV3IFQuTGl0ZXJhbE51bWVyaWNFeHByZXNzaW9uKHsgdmFsdWU6IGlkZW50IH0pKS5jb25jYXQoXG4gICAgICBleHBhbmRlZEludGVycHMsXG4gICAgKTtcblxuICAgIHJldHVybiBuZXcgVC5DYWxsRXhwcmVzc2lvbih7XG4gICAgICBjYWxsZWUsXG4gICAgICBhcmd1bWVudHM6IGFyZ3MsXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRTdGF0aWNNZW1iZXJFeHByZXNzaW9uKHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuU3RhdGljTWVtYmVyRXhwcmVzc2lvbih7XG4gICAgICBvYmplY3Q6IHRoaXMuZXhwYW5kKHRlcm0ub2JqZWN0KSxcbiAgICAgIHByb3BlcnR5OiB0ZXJtLnByb3BlcnR5LFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kU3RhdGljTWVtYmVyQXNzaWdubWVudFRhcmdldCh0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULlN0YXRpY01lbWJlckFzc2lnbm1lbnRUYXJnZXQoe1xuICAgICAgb2JqZWN0OiB0aGlzLmV4cGFuZCh0ZXJtLm9iamVjdCksXG4gICAgICBwcm9wZXJ0eTogdGVybS5wcm9wZXJ0eSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZENvbXB1dGVkTWVtYmVyQXNzaWdubWVudFRhcmdldCh0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULkNvbXB1dGVkTWVtYmVyQXNzaWdubWVudFRhcmdldCh7XG4gICAgICBvYmplY3Q6IHRoaXMuZXhwYW5kKHRlcm0ub2JqZWN0KSxcbiAgICAgIGV4cHJlc3Npb246IHRoaXMuZXhwYW5kKHRlcm0uZXhwcmVzc2lvbiksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRBcnJheUV4cHJlc3Npb24odGVybSkge1xuICAgIHJldHVybiBuZXcgVC5BcnJheUV4cHJlc3Npb24oe1xuICAgICAgZWxlbWVudHM6IHRlcm0uZWxlbWVudHMubWFwKHQgPT4gKHQgPT0gbnVsbCA/IHQgOiB0aGlzLmV4cGFuZCh0KSkpLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kSW1wb3J0KHRlcm0pIHtcbiAgICByZXR1cm4gdGVybTtcbiAgfVxuXG4gIGV4cGFuZEltcG9ydE5hbWVzcGFjZSh0ZXJtKSB7XG4gICAgcmV0dXJuIHRlcm07XG4gIH1cblxuICBleHBhbmRFeHBvcnQodGVybSkge1xuICAgIHJldHVybiBuZXcgVC5FeHBvcnQoe1xuICAgICAgZGVjbGFyYXRpb246IHRoaXMuZXhwYW5kKHRlcm0uZGVjbGFyYXRpb24pLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kRXhwb3J0RGVmYXVsdCh0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULkV4cG9ydERlZmF1bHQoe1xuICAgICAgYm9keTogdGhpcy5leHBhbmQodGVybS5ib2R5KSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZEV4cG9ydEZyb20odGVybSkge1xuICAgIHJldHVybiB0ZXJtO1xuICB9XG5cbiAgZXhwYW5kRXhwb3J0TG9jYWxzKHRlcm0pIHtcbiAgICByZXR1cm4gdGVybTtcbiAgfVxuXG4gIGV4cGFuZEV4cG9ydEFsbEZyb20odGVybSkge1xuICAgIHJldHVybiB0ZXJtO1xuICB9XG5cbiAgZXhwYW5kRXhwb3J0RnJvbVNwZWNpZmllcih0ZXJtKSB7XG4gICAgcmV0dXJuIHRlcm07XG4gIH1cblxuICBleHBhbmRFeHBvcnRMb2NhbFNwZWNpZmllcih0ZXJtKSB7XG4gICAgcmV0dXJuIHRlcm07XG4gIH1cblxuICBleHBhbmRTdGF0aWNQcm9wZXJ0eU5hbWUodGVybSkge1xuICAgIHJldHVybiB0ZXJtO1xuICB9XG5cbiAgZXhwYW5kRGF0YVByb3BlcnR5KHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuRGF0YVByb3BlcnR5KHtcbiAgICAgIG5hbWU6IHRoaXMuZXhwYW5kKHRlcm0ubmFtZSksXG4gICAgICBleHByZXNzaW9uOiB0aGlzLmV4cGFuZCh0ZXJtLmV4cHJlc3Npb24pLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kT2JqZWN0RXhwcmVzc2lvbih0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULk9iamVjdEV4cHJlc3Npb24oe1xuICAgICAgcHJvcGVydGllczogdGVybS5wcm9wZXJ0aWVzLm1hcCh0ID0+IHRoaXMuZXhwYW5kKHQpKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZFZhcmlhYmxlRGVjbGFyYXRvcih0ZXJtKSB7XG4gICAgbGV0IGluaXQgPSB0ZXJtLmluaXQgPT0gbnVsbCA/IG51bGwgOiB0aGlzLmV4cGFuZCh0ZXJtLmluaXQpO1xuICAgIHJldHVybiBuZXcgVC5WYXJpYWJsZURlY2xhcmF0b3Ioe1xuICAgICAgYmluZGluZzogdGhpcy5leHBhbmQodGVybS5iaW5kaW5nKSxcbiAgICAgIGluaXQ6IGluaXQsXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRWYXJpYWJsZURlY2xhcmF0aW9uKHRlcm0pIHtcbiAgICBpZiAoXG4gICAgICB0ZXJtLmtpbmQgPT09ICdzeW50YXgnIHx8XG4gICAgICB0ZXJtLmtpbmQgPT09ICdzeW50YXhyZWMnIHx8XG4gICAgICB0ZXJtLmtpbmQgPT09ICdvcGVyYXRvcidcbiAgICApIHtcbiAgICAgIHJldHVybiB0ZXJtO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFQuVmFyaWFibGVEZWNsYXJhdGlvbih7XG4gICAgICBraW5kOiB0ZXJtLmtpbmQsXG4gICAgICBkZWNsYXJhdG9yczogdGVybS5kZWNsYXJhdG9ycy5tYXAoZCA9PiB0aGlzLmV4cGFuZChkKSksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRQYXJlbnRoZXNpemVkRXhwcmVzc2lvbih0ZXJtKSB7XG4gICAgaWYgKHRlcm0uaW5uZXIuc2l6ZSA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmV4cGVjdGVkIGVuZCBvZiBpbnB1dCcpO1xuICAgIH1cbiAgICBsZXQgZW5mID0gbmV3IEVuZm9yZXN0ZXIodGVybS5pbm5lciwgTGlzdCgpLCB0aGlzLmNvbnRleHQpO1xuICAgIGxldCBsb29rYWhlYWQgPSBlbmYucGVlaygpO1xuICAgIGxldCB0ID0gZW5mLmVuZm9yZXN0RXhwcmVzc2lvbigpO1xuICAgIGlmICh0ID09IG51bGwgfHwgZW5mLnJlc3Quc2l6ZSA+IDApIHtcbiAgICAgIGlmIChlbmYucmVzdC5zaXplID09PSAwKSB7XG4gICAgICAgIHRocm93IGVuZi5jcmVhdGVFcnJvcignKScsICd1bmV4cGVjdGVkIHRva2VuJyk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlbmYuY3JlYXRlRXJyb3IobG9va2FoZWFkLCAndW5leHBlY3RlZCBzeW50YXgnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhwYW5kKHQpO1xuICB9XG5cbiAgZXhwYW5kVW5hcnlFeHByZXNzaW9uKHRlcm0pIHtcbiAgICBpZiAodGVybS5vcGVyYXRvciA9PT0gJ2F3YWl0Jykge1xuICAgICAgcmV0dXJuIG5ldyBULkF3YWl0RXhwcmVzc2lvbih7XG4gICAgICAgIGV4cHJlc3Npb246IHRoaXMuZXhwYW5kKHRlcm0ub3BlcmFuZCksXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBULlVuYXJ5RXhwcmVzc2lvbih7XG4gICAgICBvcGVyYXRvcjogdGVybS5vcGVyYXRvcixcbiAgICAgIG9wZXJhbmQ6IHRoaXMuZXhwYW5kKHRlcm0ub3BlcmFuZCksXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRVcGRhdGVFeHByZXNzaW9uKHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuVXBkYXRlRXhwcmVzc2lvbih7XG4gICAgICBpc1ByZWZpeDogdGVybS5pc1ByZWZpeCxcbiAgICAgIG9wZXJhdG9yOiB0ZXJtLm9wZXJhdG9yLFxuICAgICAgb3BlcmFuZDogdGhpcy5leHBhbmQodGVybS5vcGVyYW5kKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZEJpbmFyeUV4cHJlc3Npb24odGVybSkge1xuICAgIGxldCBsZWZ0ID0gdGhpcy5leHBhbmQodGVybS5sZWZ0KTtcbiAgICBsZXQgcmlnaHQgPSB0aGlzLmV4cGFuZCh0ZXJtLnJpZ2h0KTtcbiAgICByZXR1cm4gbmV3IFQuQmluYXJ5RXhwcmVzc2lvbih7XG4gICAgICBsZWZ0OiBsZWZ0LFxuICAgICAgb3BlcmF0b3I6IHRlcm0ub3BlcmF0b3IsXG4gICAgICByaWdodDogcmlnaHQsXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRDb25kaXRpb25hbEV4cHJlc3Npb24odGVybSkge1xuICAgIHJldHVybiBuZXcgVC5Db25kaXRpb25hbEV4cHJlc3Npb24oe1xuICAgICAgdGVzdDogdGhpcy5leHBhbmQodGVybS50ZXN0KSxcbiAgICAgIGNvbnNlcXVlbnQ6IHRoaXMuZXhwYW5kKHRlcm0uY29uc2VxdWVudCksXG4gICAgICBhbHRlcm5hdGU6IHRoaXMuZXhwYW5kKHRlcm0uYWx0ZXJuYXRlKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZE5ld1RhcmdldEV4cHJlc3Npb24odGVybSkge1xuICAgIHJldHVybiB0ZXJtO1xuICB9XG5cbiAgZXhwYW5kTmV3RXhwcmVzc2lvbih0ZXJtKSB7XG4gICAgbGV0IGNhbGxlZSA9IHRoaXMuZXhwYW5kKHRlcm0uY2FsbGVlKTtcbiAgICBsZXQgZW5mID0gbmV3IEVuZm9yZXN0ZXIodGVybS5hcmd1bWVudHMsIExpc3QoKSwgdGhpcy5jb250ZXh0KTtcbiAgICBsZXQgYXJncyA9IGVuZi5lbmZvcmVzdEFyZ3VtZW50TGlzdCgpLm1hcChhcmcgPT4gdGhpcy5leHBhbmQoYXJnKSk7XG4gICAgcmV0dXJuIG5ldyBULk5ld0V4cHJlc3Npb24oe1xuICAgICAgY2FsbGVlLFxuICAgICAgYXJndW1lbnRzOiBhcmdzLnRvQXJyYXkoKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZFN1cGVyKHRlcm0pIHtcbiAgICByZXR1cm4gdGVybTtcbiAgfVxuXG4gIGV4cGFuZENhbGxFeHByZXNzaW9uRSh0ZXJtKSB7XG4gICAgbGV0IGNhbGxlZSA9IHRoaXMuZXhwYW5kKHRlcm0uY2FsbGVlKTtcbiAgICBsZXQgZW5mID0gbmV3IEVuZm9yZXN0ZXIodGVybS5hcmd1bWVudHMsIExpc3QoKSwgdGhpcy5jb250ZXh0KTtcbiAgICBsZXQgYXJncyA9IGVuZi5lbmZvcmVzdEFyZ3VtZW50TGlzdCgpLm1hcChhcmcgPT4gdGhpcy5leHBhbmQoYXJnKSk7XG4gICAgcmV0dXJuIG5ldyBULkNhbGxFeHByZXNzaW9uKHtcbiAgICAgIGNhbGxlZTogY2FsbGVlLFxuICAgICAgYXJndW1lbnRzOiBhcmdzLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kU3ByZWFkRWxlbWVudCh0ZXJtKSB7XG4gICAgcmV0dXJuIG5ldyBULlNwcmVhZEVsZW1lbnQoe1xuICAgICAgZXhwcmVzc2lvbjogdGhpcy5leHBhbmQodGVybS5leHByZXNzaW9uKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZEV4cHJlc3Npb25TdGF0ZW1lbnQodGVybSkge1xuICAgIGxldCBjaGlsZCA9IHRoaXMuZXhwYW5kKHRlcm0uZXhwcmVzc2lvbik7XG4gICAgcmV0dXJuIG5ldyBULkV4cHJlc3Npb25TdGF0ZW1lbnQoe1xuICAgICAgZXhwcmVzc2lvbjogY2hpbGQsXG4gICAgfSk7XG4gIH1cblxuICBleHBhbmRMYWJlbGVkU3RhdGVtZW50KHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuTGFiZWxlZFN0YXRlbWVudCh7XG4gICAgICBsYWJlbDogdGVybS5sYWJlbC52YWwoKSxcbiAgICAgIGJvZHk6IHRoaXMuZXhwYW5kKHRlcm0uYm9keSksXG4gICAgfSk7XG4gIH1cblxuICBkb0Z1bmN0aW9uRXhwYW5zaW9uKHRlcm0sIHR5cGUpIHtcbiAgICBsZXQgc2NvcGUgPSBmcmVzaFNjb3BlKCdmdW4nKTtcbiAgICBsZXQgcGFyYW1zO1xuICAgIGxldCBzZWxmID0gdGhpcztcbiAgICBpZiAodHlwZSAhPT0gJ0dldHRlcicgJiYgdHlwZSAhPT0gJ1NldHRlcicpIHtcbiAgICAgIC8vIFRPRE86IG5lZWQgdG8gcmVnaXN0ZXIgdGhlIHBhcmFtZXRlciBiaW5kaW5ncyBhZ2FpblxuICAgICAgcGFyYW1zID0gdGVybS5wYXJhbXMucmVkdWNlKFxuICAgICAgICBuZXcgY2xhc3MgZXh0ZW5kcyBUZXJtLkNsb25lUmVkdWNlciB7XG4gICAgICAgICAgcmVkdWNlQmluZGluZ0lkZW50aWZpZXIodGVybSkge1xuICAgICAgICAgICAgbGV0IG5hbWUgPSB0ZXJtLm5hbWUuYWRkU2NvcGUoXG4gICAgICAgICAgICAgIHNjb3BlLFxuICAgICAgICAgICAgICBzZWxmLmNvbnRleHQuYmluZGluZ3MsXG4gICAgICAgICAgICAgIEFMTF9QSEFTRVMsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgbGV0IG5ld0JpbmRpbmcgPSBnZW5zeW0obmFtZS52YWwoKSk7XG5cbiAgICAgICAgICAgIHNlbGYuY29udGV4dC5lbnYuc2V0KFxuICAgICAgICAgICAgICBuZXdCaW5kaW5nLnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgIG5ldyBWYXJCaW5kaW5nVHJhbnNmb3JtKG5hbWUpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHNlbGYuY29udGV4dC5iaW5kaW5ncy5hZGQobmFtZSwge1xuICAgICAgICAgICAgICBiaW5kaW5nOiBuZXdCaW5kaW5nLFxuICAgICAgICAgICAgICBwaGFzZTogc2VsZi5jb250ZXh0LnBoYXNlLFxuICAgICAgICAgICAgICBza2lwRHVwOiB0cnVlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFQuQmluZGluZ0lkZW50aWZpZXIoeyBuYW1lIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSgpLFxuICAgICAgKTtcbiAgICAgIHBhcmFtcyA9IHRoaXMuZXhwYW5kKHBhcmFtcyk7XG4gICAgfVxuICAgIHRoaXMuY29udGV4dC5jdXJyZW50U2NvcGUucHVzaChzY29wZSk7XG4gICAgbGV0IGNvbXBpbGVyID0gbmV3IENvbXBpbGVyKFxuICAgICAgdGhpcy5jb250ZXh0LnBoYXNlLFxuICAgICAgdGhpcy5jb250ZXh0LmVudixcbiAgICAgIHRoaXMuY29udGV4dC5zdG9yZSxcbiAgICAgIE9iamVjdC5hc3NpZ24oe30sIHRoaXMuY29udGV4dCwgeyBhbGxvd0F3YWl0OiB0ZXJtLmlzQXN5bmMgfSksXG4gICAgKTtcblxuICAgIGxldCBib2R5VGVybTtcbiAgICBsZXQgc2NvcGVSZWR1Y2VyID0gbmV3IFNjb3BlUmVkdWNlcihcbiAgICAgIFt7IHNjb3BlLCBwaGFzZTogQUxMX1BIQVNFUywgZmxpcDogZmFsc2UgfV0sXG4gICAgICB0aGlzLmNvbnRleHQuYmluZGluZ3MsXG4gICAgKTtcbiAgICBpZiAodGVybS5ib2R5IGluc3RhbmNlb2YgVGVybSkge1xuICAgICAgLy8gQXJyb3cgZnVuY3Rpb25zIGhhdmUgYSBzaW5nbGUgdGVybSBhcyB0aGVpciBib2R5XG4gICAgICBib2R5VGVybSA9IHRoaXMuZXhwYW5kKHRlcm0uYm9keS5yZWR1Y2Uoc2NvcGVSZWR1Y2VyKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBjb21waWxlZEJvZHkgPSBjb21waWxlci5jb21waWxlKFxuICAgICAgICB0ZXJtLmJvZHkubWFwKGIgPT4gYi5yZWR1Y2Uoc2NvcGVSZWR1Y2VyKSksXG4gICAgICApO1xuICAgICAgY29uc3QgZGlyZWN0aXZlcyA9IGNvbXBpbGVkQm9keVxuICAgICAgICAudGFrZVdoaWxlKFxuICAgICAgICAgIHMgPT5cbiAgICAgICAgICAgIGlzRXhwcmVzc2lvblN0YXRlbWVudChzKSAmJiBpc0xpdGVyYWxTdHJpbmdFeHByZXNzaW9uKHMuZXhwcmVzc2lvbiksXG4gICAgICAgIClcbiAgICAgICAgLm1hcChzID0+IG5ldyBULkRpcmVjdGl2ZSh7IHJhd1ZhbHVlOiBzLmV4cHJlc3Npb24udmFsdWUgfSkpO1xuICAgICAgYm9keVRlcm0gPSBuZXcgVC5GdW5jdGlvbkJvZHkoe1xuICAgICAgICBkaXJlY3RpdmVzOiBkaXJlY3RpdmVzLFxuICAgICAgICBzdGF0ZW1lbnRzOiBjb21waWxlZEJvZHkuc2xpY2UoZGlyZWN0aXZlcy5zaXplKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICB0aGlzLmNvbnRleHQuY3VycmVudFNjb3BlLnBvcCgpO1xuXG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlICdHZXR0ZXInOlxuICAgICAgICByZXR1cm4gbmV3IFQuR2V0dGVyKHtcbiAgICAgICAgICBuYW1lOiB0aGlzLmV4cGFuZCh0ZXJtLm5hbWUpLFxuICAgICAgICAgIGJvZHk6IGJvZHlUZXJtLFxuICAgICAgICB9KTtcbiAgICAgIGNhc2UgJ1NldHRlcic6XG4gICAgICAgIHJldHVybiBuZXcgVC5TZXR0ZXIoe1xuICAgICAgICAgIG5hbWU6IHRoaXMuZXhwYW5kKHRlcm0ubmFtZSksXG4gICAgICAgICAgcGFyYW06IHRlcm0ucGFyYW0sXG4gICAgICAgICAgYm9keTogYm9keVRlcm0sXG4gICAgICAgIH0pO1xuICAgICAgY2FzZSAnTWV0aG9kJzpcbiAgICAgICAgcmV0dXJuIG5ldyBULk1ldGhvZCh7XG4gICAgICAgICAgbmFtZTogdGVybS5uYW1lLFxuICAgICAgICAgIGlzQXN5bmM6IHRlcm0uaXNBc3luYyxcbiAgICAgICAgICBpc0dlbmVyYXRvcjogdGVybS5pc0dlbmVyYXRvcixcbiAgICAgICAgICBwYXJhbXM6IHBhcmFtcyxcbiAgICAgICAgICBib2R5OiBib2R5VGVybSxcbiAgICAgICAgfSk7XG4gICAgICBjYXNlICdBcnJvd0V4cHJlc3Npb24nOlxuICAgICAgICByZXR1cm4gbmV3IFQuQXJyb3dFeHByZXNzaW9uKHtcbiAgICAgICAgICBpc0FzeW5jOiB0ZXJtLmlzQXN5bmMsXG4gICAgICAgICAgcGFyYW1zOiBwYXJhbXMsXG4gICAgICAgICAgYm9keTogYm9keVRlcm0sXG4gICAgICAgIH0pO1xuICAgICAgY2FzZSAnRnVuY3Rpb25FeHByZXNzaW9uJzpcbiAgICAgICAgcmV0dXJuIG5ldyBULkZ1bmN0aW9uRXhwcmVzc2lvbih7XG4gICAgICAgICAgbmFtZTogdGVybS5uYW1lLFxuICAgICAgICAgIGlzQXN5bmM6IHRlcm0uaXNBc3luYyxcbiAgICAgICAgICBpc0dlbmVyYXRvcjogdGVybS5pc0dlbmVyYXRvcixcbiAgICAgICAgICBwYXJhbXM6IHBhcmFtcyxcbiAgICAgICAgICBib2R5OiBib2R5VGVybSxcbiAgICAgICAgfSk7XG4gICAgICBjYXNlICdGdW5jdGlvbkRlY2xhcmF0aW9uJzpcbiAgICAgICAgcmV0dXJuIG5ldyBULkZ1bmN0aW9uRGVjbGFyYXRpb24oe1xuICAgICAgICAgIG5hbWU6IHRlcm0ubmFtZSxcbiAgICAgICAgICBpc0FzeW5jOiB0ZXJtLmlzQXN5bmMsXG4gICAgICAgICAgaXNHZW5lcmF0b3I6IHRlcm0uaXNHZW5lcmF0b3IsXG4gICAgICAgICAgcGFyYW1zOiBwYXJhbXMsXG4gICAgICAgICAgYm9keTogYm9keVRlcm0sXG4gICAgICAgIH0pO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGZ1bmN0aW9uIHR5cGU6ICR7dHlwZX1gKTtcbiAgICB9XG4gIH1cblxuICBleHBhbmRNZXRob2QodGVybSkge1xuICAgIHJldHVybiB0aGlzLmRvRnVuY3Rpb25FeHBhbnNpb24odGVybSwgJ01ldGhvZCcpO1xuICB9XG5cbiAgZXhwYW5kU2V0dGVyKHRlcm0pIHtcbiAgICByZXR1cm4gdGhpcy5kb0Z1bmN0aW9uRXhwYW5zaW9uKHRlcm0sICdTZXR0ZXInKTtcbiAgfVxuXG4gIGV4cGFuZEdldHRlcih0ZXJtKSB7XG4gICAgcmV0dXJuIHRoaXMuZG9GdW5jdGlvbkV4cGFuc2lvbih0ZXJtLCAnR2V0dGVyJyk7XG4gIH1cblxuICBleHBhbmRGdW5jdGlvbkRlY2xhcmF0aW9uRSh0ZXJtKSB7XG4gICAgcmV0dXJuIHRoaXMuZG9GdW5jdGlvbkV4cGFuc2lvbih0ZXJtLCAnRnVuY3Rpb25EZWNsYXJhdGlvbicpO1xuICB9XG5cbiAgZXhwYW5kRnVuY3Rpb25FeHByZXNzaW9uRSh0ZXJtKSB7XG4gICAgcmV0dXJuIHRoaXMuZG9GdW5jdGlvbkV4cGFuc2lvbih0ZXJtLCAnRnVuY3Rpb25FeHByZXNzaW9uJyk7XG4gIH1cblxuICBleHBhbmRDb21wb3VuZEFzc2lnbm1lbnRFeHByZXNzaW9uKHRlcm0pIHtcbiAgICByZXR1cm4gbmV3IFQuQ29tcG91bmRBc3NpZ25tZW50RXhwcmVzc2lvbih7XG4gICAgICBiaW5kaW5nOiB0aGlzLmV4cGFuZCh0ZXJtLmJpbmRpbmcpLFxuICAgICAgb3BlcmF0b3I6IHRlcm0ub3BlcmF0b3IsXG4gICAgICBleHByZXNzaW9uOiB0aGlzLmV4cGFuZCh0ZXJtLmV4cHJlc3Npb24pLFxuICAgIH0pO1xuICB9XG5cbiAgZXhwYW5kQXNzaWdubWVudEV4cHJlc3Npb24odGVybSkge1xuICAgIHJldHVybiBuZXcgVC5Bc3NpZ25tZW50RXhwcmVzc2lvbih7XG4gICAgICBiaW5kaW5nOiB0aGlzLmV4cGFuZCh0ZXJtLmJpbmRpbmcpLFxuICAgICAgZXhwcmVzc2lvbjogdGhpcy5leHBhbmQodGVybS5leHByZXNzaW9uKSxcbiAgICB9KTtcbiAgfVxuXG4gIGV4cGFuZEVtcHR5U3RhdGVtZW50KHRlcm0pIHtcbiAgICByZXR1cm4gdGVybTtcbiAgfVxuXG4gIGV4cGFuZExpdGVyYWxCb29sZWFuRXhwcmVzc2lvbih0ZXJtKSB7XG4gICAgcmV0dXJuIHRlcm07XG4gIH1cblxuICBleHBhbmRMaXRlcmFsTnVtZXJpY0V4cHJlc3Npb24odGVybSkge1xuICAgIHJldHVybiB0ZXJtO1xuICB9XG4gIGV4cGFuZExpdGVyYWxJbmZpbml0eUV4cHJlc3Npb24odGVybSkge1xuICAgIHJldHVybiB0ZXJtO1xuICB9XG5cbiAgZXhwYW5kSWRlbnRpZmllckV4cHJlc3Npb24odGVybSkge1xuICAgIGxldCB0cmFucyA9IHRoaXMuY29udGV4dC5lbnYuZ2V0KHRlcm0ubmFtZS5yZXNvbHZlKHRoaXMuY29udGV4dC5waGFzZSkpO1xuICAgIGlmICh0cmFucyAmJiB0cmFucy5pZCkge1xuICAgICAgcmV0dXJuIG5ldyBULklkZW50aWZpZXJFeHByZXNzaW9uKHtcbiAgICAgICAgbmFtZTogdHJhbnMuaWQsXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRlcm07XG4gIH1cblxuICBleHBhbmRMaXRlcmFsTnVsbEV4cHJlc3Npb24odGVybSkge1xuICAgIHJldHVybiB0ZXJtO1xuICB9XG5cbiAgZXhwYW5kTGl0ZXJhbFN0cmluZ0V4cHJlc3Npb24odGVybSkge1xuICAgIHJldHVybiB0ZXJtO1xuICB9XG5cbiAgZXhwYW5kTGl0ZXJhbFJlZ0V4cEV4cHJlc3Npb24odGVybSkge1xuICAgIHJldHVybiB0ZXJtO1xuICB9XG59XG4iXX0=