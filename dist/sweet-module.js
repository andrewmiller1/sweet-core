'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _sweetSpec = require('sweet-spec');

var T = _interopRequireWildcard(_sweetSpec);

var _ramda = require('ramda');

var _ = _interopRequireWildcard(_ramda);

var _sweetSpecUtils = require('./sweet-spec-utils');

var S = _interopRequireWildcard(_sweetSpecUtils);

var _codegen = require('./codegen');

var _codegen2 = _interopRequireDefault(_codegen);

var _immutable = require('immutable');

var _sweetToShiftReducer = require('./sweet-to-shift-reducer.js');

var _sweetToShiftReducer2 = _interopRequireDefault(_sweetToShiftReducer);

var _syntax = require('./syntax');

var _syntax2 = _interopRequireDefault(_syntax);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

const extractDeclaration = _.cond([[S.isExport, _.prop('declaration')], [S.isExportDefault, _.prop('body')], [_.T, term => {
  throw new Error(`Expecting an Export or ExportDefault but got ${term}`);
}]]);


const ExpSpec = x => ({
  exportedName: x
});

const extractDeclarationNames = _.cond([[S.isVariableDeclarator, ({ binding }) => _immutable.List.of(binding.name)], [S.isVariableDeclaration, ({ declarators }) => declarators.flatMap(extractDeclarationNames)], [S.isFunctionDeclaration, ({ name }) => _immutable.List.of(name.name)], [S.isClassDeclaration, ({ name }) => _immutable.List.of(name.name)]]);

const extractDeclarationSpecifiers = _.cond([[S.isVariableDeclarator, ({ binding }) => _immutable.List.of(ExpSpec(binding.name))], [S.isVariableDeclaration, ({ declarators }) => declarators.flatMap(extractDeclarationSpecifiers)], [S.isFunctionDeclaration, ({ name }) => _immutable.List.of(ExpSpec(name.name))], [S.isClassDeclaration, ({ name }) => _immutable.List.of(ExpSpec(name.name))]]);

function extractSpecifiers(term) {
  if (S.isExport(term)) {
    return extractDeclarationSpecifiers(term.declaration);
  } else if (S.isExportDefault(term)) {
    return (0, _immutable.List)();
  } else if (S.isExportFrom(term)) {
    return term.namedExports;
  } else if (S.isExportLocals(term)) {
    return term.namedExports.map(({ name, exportedName }) => ({
      name: name == null ? null : name.name,
      exportedName: exportedName
    }));
  }
  throw new Error(`Unknown export type`);
}

function wrapStatement(declaration) {
  if (S.isVariableDeclaration(declaration)) {
    return new T.VariableDeclarationStatement({
      declaration
    });
  }
  return declaration;
}

const memoSym = Symbol('memo');

function makeVarDeclStmt(name, expr) {
  return new T.VariableDeclarationStatement({
    declaration: new T.VariableDeclaration({
      kind: 'var',
      declarators: _immutable.List.of(new T.VariableDeclarator({
        binding: name,
        init: expr
      }))
    })
  });
}

class SweetModule {

  constructor(path, items) {
    let moreDirectives = true;
    let directives = [];
    let body = [];
    let imports = [];
    let exports = [];
    this.path = path;
    this.exportedNames = (0, _immutable.List)();
    for (let item of items) {
      if (moreDirectives && item instanceof T.ExpressionStatement && item.expression instanceof T.LiteralStringExpression) {
        directives.push(item.expression.value);
        continue;
      } else {
        moreDirectives = false;
      }

      if (item instanceof T.ImportDeclaration) {
        imports.push(item);
      } else if (item instanceof T.ExportDeclaration) {
        if (S.isExport(item)) {
          let decl = extractDeclaration(item);
          let stmt = wrapStatement(decl);
          let names = extractDeclarationNames(decl);
          body.push(stmt);
          // TODO: support ExportFrom
          let exp = new T.ExportLocals({
            moduleSpecifier: null,
            namedExports: names.map(name => new T.ExportLocalSpecifier({
              name: new T.IdentifierExpression({
                name
              }),
              exportedName: name
            }))
          });
          body.push(exp);
          exports.push(exp);
          this.exportedNames = this.exportedNames.concat(extractSpecifiers(exp));
        } else if (item instanceof T.ExportLocals) {
          let exp = new T.ExportLocals({
            namedExports: item.namedExports.map(({ name, exportedName }) => {
              if (name == null) {
                return new T.ExportLocalSpecifier({
                  name: new T.IdentifierExpression({
                    name: exportedName
                  }),
                  exportedName
                });
              }
              return new T.ExportLocalSpecifier({
                name,
                exportedName
              });
            })
          });
          body.push(exp);
          exports.push(exp);
          this.exportedNames = this.exportedNames.concat(extractSpecifiers(exp));
        } else {
          exports.push(item);
          body.push(item);
          this.exportedNames = this.exportedNames.concat(extractSpecifiers(item));
          if (S.isExportDefault(item)) {
            this.defaultExport = _syntax2.default.fromIdentifier('_default');
            this.exportedNames = this.exportedNames.push(ExpSpec(this.defaultExport));
          }
        }
      } else {
        body.push(item);
      }
    }
    this.items = (0, _immutable.List)(body);
    this.imports = (0, _immutable.List)(imports);
    this.exports = (0, _immutable.List)(exports);
    this.directives = (0, _immutable.List)(directives);
  }

  // $FlowFixMe: flow doesn't support computed property keys yet
  [memoSym]() {
    let runtime = [],
        compiletime = [];
    for (let item of this.items) {
      if (S.isExportDeclaration(item)) {
        if (S.isExportDefault(item)) {
          let decl = extractDeclaration(item);
          let def = new T.BindingIdentifier({
            name: this.defaultExport
          });
          if (S.isFunctionDeclaration(decl) || S.isClassDeclaration(decl)) {
            runtime.push(decl);
            // extract name and bind it to _default
            runtime.push(makeVarDeclStmt(def, new T.IdentifierExpression({
              name: decl.name.name
            })));
          } else {
            // expression so bind it to _default
            let stmt = makeVarDeclStmt(def, decl);
            if (S.isCompiletimeStatement(stmt)) {
              compiletime.push(stmt);
            } else {
              runtime.push(stmt);
            }
          }
        }
      } else {
        if (S.isCompiletimeStatement(item)) {
          compiletime.push(item);
        } else {
          runtime.push(item);
        }
      }
    }
    this.runtime = (0, _immutable.List)(runtime);
    this.compiletime = (0, _immutable.List)(compiletime);
  }

  runtimeItems() {
    if (this.runtime == null) {
      // $FlowFixMe: flow doesn't support computed property keys yet
      this[memoSym]();
    }
    return this.runtime;
  }

  compiletimeItems() {
    if (this.compiletime == null) {
      // $FlowFixMe: flow doesn't support computed property keys yet
      this[memoSym]();
    }
    return this.compiletime;
  }

  parse() {
    return new T.Module({
      items: this.imports.concat(this.items),
      directives: this.directives
      // $FlowFixMe: flow doesn't know about reduce yet
    }).reduce(new _sweetToShiftReducer2.default(0));
  }

  codegen() {
    return (0, _codegen2.default)(this.parse()).code;
  }
}
exports.default = SweetModule;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zd2VldC1tb2R1bGUuanMiXSwibmFtZXMiOlsiVCIsIl8iLCJTIiwiZXh0cmFjdERlY2xhcmF0aW9uIiwiY29uZCIsImlzRXhwb3J0IiwicHJvcCIsImlzRXhwb3J0RGVmYXVsdCIsInRlcm0iLCJFcnJvciIsIkV4cFNwZWMiLCJ4IiwiZXhwb3J0ZWROYW1lIiwiZXh0cmFjdERlY2xhcmF0aW9uTmFtZXMiLCJpc1ZhcmlhYmxlRGVjbGFyYXRvciIsImJpbmRpbmciLCJvZiIsIm5hbWUiLCJpc1ZhcmlhYmxlRGVjbGFyYXRpb24iLCJkZWNsYXJhdG9ycyIsImZsYXRNYXAiLCJpc0Z1bmN0aW9uRGVjbGFyYXRpb24iLCJpc0NsYXNzRGVjbGFyYXRpb24iLCJleHRyYWN0RGVjbGFyYXRpb25TcGVjaWZpZXJzIiwiZXh0cmFjdFNwZWNpZmllcnMiLCJkZWNsYXJhdGlvbiIsImlzRXhwb3J0RnJvbSIsIm5hbWVkRXhwb3J0cyIsImlzRXhwb3J0TG9jYWxzIiwibWFwIiwid3JhcFN0YXRlbWVudCIsIlZhcmlhYmxlRGVjbGFyYXRpb25TdGF0ZW1lbnQiLCJtZW1vU3ltIiwiU3ltYm9sIiwibWFrZVZhckRlY2xTdG10IiwiZXhwciIsIlZhcmlhYmxlRGVjbGFyYXRpb24iLCJraW5kIiwiVmFyaWFibGVEZWNsYXJhdG9yIiwiaW5pdCIsIlN3ZWV0TW9kdWxlIiwiY29uc3RydWN0b3IiLCJwYXRoIiwiaXRlbXMiLCJtb3JlRGlyZWN0aXZlcyIsImRpcmVjdGl2ZXMiLCJib2R5IiwiaW1wb3J0cyIsImV4cG9ydHMiLCJleHBvcnRlZE5hbWVzIiwiaXRlbSIsIkV4cHJlc3Npb25TdGF0ZW1lbnQiLCJleHByZXNzaW9uIiwiTGl0ZXJhbFN0cmluZ0V4cHJlc3Npb24iLCJwdXNoIiwidmFsdWUiLCJJbXBvcnREZWNsYXJhdGlvbiIsIkV4cG9ydERlY2xhcmF0aW9uIiwiZGVjbCIsInN0bXQiLCJuYW1lcyIsImV4cCIsIkV4cG9ydExvY2FscyIsIm1vZHVsZVNwZWNpZmllciIsIkV4cG9ydExvY2FsU3BlY2lmaWVyIiwiSWRlbnRpZmllckV4cHJlc3Npb24iLCJjb25jYXQiLCJkZWZhdWx0RXhwb3J0IiwiZnJvbUlkZW50aWZpZXIiLCJydW50aW1lIiwiY29tcGlsZXRpbWUiLCJpc0V4cG9ydERlY2xhcmF0aW9uIiwiZGVmIiwiQmluZGluZ0lkZW50aWZpZXIiLCJpc0NvbXBpbGV0aW1lU3RhdGVtZW50IiwicnVudGltZUl0ZW1zIiwiY29tcGlsZXRpbWVJdGVtcyIsInBhcnNlIiwiTW9kdWxlIiwicmVkdWNlIiwiY29kZWdlbiIsImNvZGUiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUNBOztJQUFrQkEsQzs7QUFDbEI7O0lBQVlDLEM7O0FBQ1o7O0lBQVlDLEM7O0FBQ1o7Ozs7QUFDQTs7QUFDQTs7OztBQUNBOzs7Ozs7OztBQUVBLE1BQU1DLHFCQUFxQkYsRUFBRUcsSUFBRixDQUFPLENBQ2hDLENBQUNGLEVBQUVHLFFBQUgsRUFBYUosRUFBRUssSUFBRixDQUFPLGFBQVAsQ0FBYixDQURnQyxFQUVoQyxDQUFDSixFQUFFSyxlQUFILEVBQW9CTixFQUFFSyxJQUFGLENBQU8sTUFBUCxDQUFwQixDQUZnQyxFQUdoQyxDQUNFTCxFQUFFRCxDQURKLEVBRUVRLFFBQVE7QUFDTixRQUFNLElBQUlDLEtBQUosQ0FBVyxnREFBK0NELElBQUssRUFBL0QsQ0FBTjtBQUNELENBSkgsQ0FIZ0MsQ0FBUCxDQUEzQjs7O0FBV0EsTUFBTUUsVUFBVUMsTUFBTTtBQUNwQkMsZ0JBQWNEO0FBRE0sQ0FBTixDQUFoQjs7QUFJQSxNQUFNRSwwQkFBMEJaLEVBQUVHLElBQUYsQ0FBTyxDQUNyQyxDQUFDRixFQUFFWSxvQkFBSCxFQUF5QixDQUFDLEVBQUVDLE9BQUYsRUFBRCxLQUFpQixnQkFBS0MsRUFBTCxDQUFRRCxRQUFRRSxJQUFoQixDQUExQyxDQURxQyxFQUVyQyxDQUNFZixFQUFFZ0IscUJBREosRUFFRSxDQUFDLEVBQUVDLFdBQUYsRUFBRCxLQUFxQkEsWUFBWUMsT0FBWixDQUFvQlAsdUJBQXBCLENBRnZCLENBRnFDLEVBTXJDLENBQUNYLEVBQUVtQixxQkFBSCxFQUEwQixDQUFDLEVBQUVKLElBQUYsRUFBRCxLQUFjLGdCQUFLRCxFQUFMLENBQVFDLEtBQUtBLElBQWIsQ0FBeEMsQ0FOcUMsRUFPckMsQ0FBQ2YsRUFBRW9CLGtCQUFILEVBQXVCLENBQUMsRUFBRUwsSUFBRixFQUFELEtBQWMsZ0JBQUtELEVBQUwsQ0FBUUMsS0FBS0EsSUFBYixDQUFyQyxDQVBxQyxDQUFQLENBQWhDOztBQVVBLE1BQU1NLCtCQUErQnRCLEVBQUVHLElBQUYsQ0FBTyxDQUMxQyxDQUFDRixFQUFFWSxvQkFBSCxFQUF5QixDQUFDLEVBQUVDLE9BQUYsRUFBRCxLQUFpQixnQkFBS0MsRUFBTCxDQUFRTixRQUFRSyxRQUFRRSxJQUFoQixDQUFSLENBQTFDLENBRDBDLEVBRTFDLENBQ0VmLEVBQUVnQixxQkFESixFQUVFLENBQUMsRUFBRUMsV0FBRixFQUFELEtBQXFCQSxZQUFZQyxPQUFaLENBQW9CRyw0QkFBcEIsQ0FGdkIsQ0FGMEMsRUFNMUMsQ0FBQ3JCLEVBQUVtQixxQkFBSCxFQUEwQixDQUFDLEVBQUVKLElBQUYsRUFBRCxLQUFjLGdCQUFLRCxFQUFMLENBQVFOLFFBQVFPLEtBQUtBLElBQWIsQ0FBUixDQUF4QyxDQU4wQyxFQU8xQyxDQUFDZixFQUFFb0Isa0JBQUgsRUFBdUIsQ0FBQyxFQUFFTCxJQUFGLEVBQUQsS0FBYyxnQkFBS0QsRUFBTCxDQUFRTixRQUFRTyxLQUFLQSxJQUFiLENBQVIsQ0FBckMsQ0FQMEMsQ0FBUCxDQUFyQzs7QUFlQSxTQUFTTyxpQkFBVCxDQUEyQmhCLElBQTNCLEVBQTZEO0FBQzNELE1BQUlOLEVBQUVHLFFBQUYsQ0FBV0csSUFBWCxDQUFKLEVBQXNCO0FBQ3BCLFdBQU9lLDZCQUE2QmYsS0FBS2lCLFdBQWxDLENBQVA7QUFDRCxHQUZELE1BRU8sSUFBSXZCLEVBQUVLLGVBQUYsQ0FBa0JDLElBQWxCLENBQUosRUFBNkI7QUFDbEMsV0FBTyxzQkFBUDtBQUNELEdBRk0sTUFFQSxJQUFJTixFQUFFd0IsWUFBRixDQUFlbEIsSUFBZixDQUFKLEVBQTBCO0FBQy9CLFdBQU9BLEtBQUttQixZQUFaO0FBQ0QsR0FGTSxNQUVBLElBQUl6QixFQUFFMEIsY0FBRixDQUFpQnBCLElBQWpCLENBQUosRUFBNEI7QUFDakMsV0FBT0EsS0FBS21CLFlBQUwsQ0FBa0JFLEdBQWxCLENBQXNCLENBQUMsRUFBRVosSUFBRixFQUFRTCxZQUFSLEVBQUQsTUFBNkI7QUFDeERLLFlBQU1BLFFBQVEsSUFBUixHQUFlLElBQWYsR0FBc0JBLEtBQUtBLElBRHVCO0FBRXhETCxvQkFBY0E7QUFGMEMsS0FBN0IsQ0FBdEIsQ0FBUDtBQUlEO0FBQ0QsUUFBTSxJQUFJSCxLQUFKLENBQVcscUJBQVgsQ0FBTjtBQUNEOztBQUVELFNBQVNxQixhQUFULENBQXVCTCxXQUF2QixFQUEwQztBQUN4QyxNQUFJdkIsRUFBRWdCLHFCQUFGLENBQXdCTyxXQUF4QixDQUFKLEVBQTBDO0FBQ3hDLFdBQU8sSUFBSXpCLEVBQUUrQiw0QkFBTixDQUFtQztBQUN4Q047QUFEd0MsS0FBbkMsQ0FBUDtBQUdEO0FBQ0QsU0FBT0EsV0FBUDtBQUNEOztBQUVELE1BQU1PLFVBQVVDLE9BQU8sTUFBUCxDQUFoQjs7QUFFQSxTQUFTQyxlQUFULENBQXlCakIsSUFBekIsRUFBb0RrQixJQUFwRCxFQUF3RTtBQUN0RSxTQUFPLElBQUluQyxFQUFFK0IsNEJBQU4sQ0FBbUM7QUFDeENOLGlCQUFhLElBQUl6QixFQUFFb0MsbUJBQU4sQ0FBMEI7QUFDckNDLFlBQU0sS0FEK0I7QUFFckNsQixtQkFBYSxnQkFBS0gsRUFBTCxDQUNYLElBQUloQixFQUFFc0Msa0JBQU4sQ0FBeUI7QUFDdkJ2QixpQkFBU0UsSUFEYztBQUV2QnNCLGNBQU1KO0FBRmlCLE9BQXpCLENBRFc7QUFGd0IsS0FBMUI7QUFEMkIsR0FBbkMsQ0FBUDtBQVdEOztBQUVjLE1BQU1LLFdBQU4sQ0FBa0I7O0FBWS9CQyxjQUFZQyxJQUFaLEVBQTBCQyxLQUExQixFQUE2QztBQUMzQyxRQUFJQyxpQkFBaUIsSUFBckI7QUFDQSxRQUFJQyxhQUFhLEVBQWpCO0FBQ0EsUUFBSUMsT0FBTyxFQUFYO0FBQ0EsUUFBSUMsVUFBVSxFQUFkO0FBQ0EsUUFBSUMsVUFBVSxFQUFkO0FBQ0EsU0FBS04sSUFBTCxHQUFZQSxJQUFaO0FBQ0EsU0FBS08sYUFBTCxHQUFxQixzQkFBckI7QUFDQSxTQUFLLElBQUlDLElBQVQsSUFBaUJQLEtBQWpCLEVBQXdCO0FBQ3RCLFVBQ0VDLGtCQUNBTSxnQkFBZ0JsRCxFQUFFbUQsbUJBRGxCLElBRUFELEtBQUtFLFVBQUwsWUFBMkJwRCxFQUFFcUQsdUJBSC9CLEVBSUU7QUFDQVIsbUJBQVdTLElBQVgsQ0FBZ0JKLEtBQUtFLFVBQUwsQ0FBZ0JHLEtBQWhDO0FBQ0E7QUFDRCxPQVBELE1BT087QUFDTFgseUJBQWlCLEtBQWpCO0FBQ0Q7O0FBRUQsVUFBSU0sZ0JBQWdCbEQsRUFBRXdELGlCQUF0QixFQUF5QztBQUN2Q1QsZ0JBQVFPLElBQVIsQ0FBYUosSUFBYjtBQUNELE9BRkQsTUFFTyxJQUFJQSxnQkFBZ0JsRCxFQUFFeUQsaUJBQXRCLEVBQXlDO0FBQzlDLFlBQUl2RCxFQUFFRyxRQUFGLENBQVc2QyxJQUFYLENBQUosRUFBc0I7QUFDcEIsY0FBSVEsT0FBT3ZELG1CQUFtQitDLElBQW5CLENBQVg7QUFDQSxjQUFJUyxPQUFPN0IsY0FBYzRCLElBQWQsQ0FBWDtBQUNBLGNBQUlFLFFBQVEvQyx3QkFBd0I2QyxJQUF4QixDQUFaO0FBQ0FaLGVBQUtRLElBQUwsQ0FBVUssSUFBVjtBQUNBO0FBQ0EsY0FBSUUsTUFBTSxJQUFJN0QsRUFBRThELFlBQU4sQ0FBbUI7QUFDM0JDLDZCQUFpQixJQURVO0FBRTNCcEMsMEJBQWNpQyxNQUFNL0IsR0FBTixDQUNaWixRQUNFLElBQUlqQixFQUFFZ0Usb0JBQU4sQ0FBMkI7QUFDekIvQyxvQkFBTSxJQUFJakIsRUFBRWlFLG9CQUFOLENBQTJCO0FBQy9CaEQ7QUFEK0IsZUFBM0IsQ0FEbUI7QUFJekJMLDRCQUFjSztBQUpXLGFBQTNCLENBRlU7QUFGYSxXQUFuQixDQUFWO0FBWUE2QixlQUFLUSxJQUFMLENBQVVPLEdBQVY7QUFDQWIsa0JBQVFNLElBQVIsQ0FBYU8sR0FBYjtBQUNBLGVBQUtaLGFBQUwsR0FBcUIsS0FBS0EsYUFBTCxDQUFtQmlCLE1BQW5CLENBQ25CMUMsa0JBQWtCcUMsR0FBbEIsQ0FEbUIsQ0FBckI7QUFHRCxTQXZCRCxNQXVCTyxJQUFJWCxnQkFBZ0JsRCxFQUFFOEQsWUFBdEIsRUFBb0M7QUFDekMsY0FBSUQsTUFBTSxJQUFJN0QsRUFBRThELFlBQU4sQ0FBbUI7QUFDM0JuQywwQkFBY3VCLEtBQUt2QixZQUFMLENBQWtCRSxHQUFsQixDQUFzQixDQUFDLEVBQUVaLElBQUYsRUFBUUwsWUFBUixFQUFELEtBQTRCO0FBQzlELGtCQUFJSyxRQUFRLElBQVosRUFBa0I7QUFDaEIsdUJBQU8sSUFBSWpCLEVBQUVnRSxvQkFBTixDQUEyQjtBQUNoQy9DLHdCQUFNLElBQUlqQixFQUFFaUUsb0JBQU4sQ0FBMkI7QUFDL0JoRCwwQkFBTUw7QUFEeUIsbUJBQTNCLENBRDBCO0FBSWhDQTtBQUpnQyxpQkFBM0IsQ0FBUDtBQU1EO0FBQ0QscUJBQU8sSUFBSVosRUFBRWdFLG9CQUFOLENBQTJCO0FBQ2hDL0Msb0JBRGdDO0FBRWhDTDtBQUZnQyxlQUEzQixDQUFQO0FBSUQsYUFiYTtBQURhLFdBQW5CLENBQVY7QUFnQkFrQyxlQUFLUSxJQUFMLENBQVVPLEdBQVY7QUFDQWIsa0JBQVFNLElBQVIsQ0FBYU8sR0FBYjtBQUNBLGVBQUtaLGFBQUwsR0FBcUIsS0FBS0EsYUFBTCxDQUFtQmlCLE1BQW5CLENBQ25CMUMsa0JBQWtCcUMsR0FBbEIsQ0FEbUIsQ0FBckI7QUFHRCxTQXRCTSxNQXNCQTtBQUNMYixrQkFBUU0sSUFBUixDQUFhSixJQUFiO0FBQ0FKLGVBQUtRLElBQUwsQ0FBVUosSUFBVjtBQUNBLGVBQUtELGFBQUwsR0FBcUIsS0FBS0EsYUFBTCxDQUFtQmlCLE1BQW5CLENBQ25CMUMsa0JBQWtCMEIsSUFBbEIsQ0FEbUIsQ0FBckI7QUFHQSxjQUFJaEQsRUFBRUssZUFBRixDQUFrQjJDLElBQWxCLENBQUosRUFBNkI7QUFDM0IsaUJBQUtpQixhQUFMLEdBQXFCLGlCQUFPQyxjQUFQLENBQXNCLFVBQXRCLENBQXJCO0FBQ0EsaUJBQUtuQixhQUFMLEdBQXFCLEtBQUtBLGFBQUwsQ0FBbUJLLElBQW5CLENBQ25CNUMsUUFBUSxLQUFLeUQsYUFBYixDQURtQixDQUFyQjtBQUdEO0FBQ0Y7QUFDRixPQTNETSxNQTJEQTtBQUNMckIsYUFBS1EsSUFBTCxDQUFVSixJQUFWO0FBQ0Q7QUFDRjtBQUNELFNBQUtQLEtBQUwsR0FBYSxxQkFBS0csSUFBTCxDQUFiO0FBQ0EsU0FBS0MsT0FBTCxHQUFlLHFCQUFLQSxPQUFMLENBQWY7QUFDQSxTQUFLQyxPQUFMLEdBQWUscUJBQUtBLE9BQUwsQ0FBZjtBQUNBLFNBQUtILFVBQUwsR0FBa0IscUJBQUtBLFVBQUwsQ0FBbEI7QUFDRDs7QUFFRDtBQUNBLEdBQUNiLE9BQUQsSUFBWTtBQUNWLFFBQUlxQyxVQUFVLEVBQWQ7QUFBQSxRQUNFQyxjQUFjLEVBRGhCO0FBRUEsU0FBSyxJQUFJcEIsSUFBVCxJQUFpQixLQUFLUCxLQUF0QixFQUE2QjtBQUMzQixVQUFJekMsRUFBRXFFLG1CQUFGLENBQXNCckIsSUFBdEIsQ0FBSixFQUFpQztBQUMvQixZQUFJaEQsRUFBRUssZUFBRixDQUFrQjJDLElBQWxCLENBQUosRUFBNkI7QUFDM0IsY0FBSVEsT0FBT3ZELG1CQUFtQitDLElBQW5CLENBQVg7QUFDQSxjQUFJc0IsTUFBTSxJQUFJeEUsRUFBRXlFLGlCQUFOLENBQXdCO0FBQ2hDeEQsa0JBQU0sS0FBS2tEO0FBRHFCLFdBQXhCLENBQVY7QUFHQSxjQUFJakUsRUFBRW1CLHFCQUFGLENBQXdCcUMsSUFBeEIsS0FBaUN4RCxFQUFFb0Isa0JBQUYsQ0FBcUJvQyxJQUFyQixDQUFyQyxFQUFpRTtBQUMvRFcsb0JBQVFmLElBQVIsQ0FBYUksSUFBYjtBQUNBO0FBQ0FXLG9CQUFRZixJQUFSLENBQ0VwQixnQkFDRXNDLEdBREYsRUFFRSxJQUFJeEUsRUFBRWlFLG9CQUFOLENBQTJCO0FBQ3pCaEQsb0JBQU15QyxLQUFLekMsSUFBTCxDQUFVQTtBQURTLGFBQTNCLENBRkYsQ0FERjtBQVFELFdBWEQsTUFXTztBQUNMO0FBQ0EsZ0JBQUkwQyxPQUFPekIsZ0JBQWdCc0MsR0FBaEIsRUFBcUJkLElBQXJCLENBQVg7QUFDQSxnQkFBSXhELEVBQUV3RSxzQkFBRixDQUF5QmYsSUFBekIsQ0FBSixFQUFvQztBQUNsQ1csMEJBQVloQixJQUFaLENBQWlCSyxJQUFqQjtBQUNELGFBRkQsTUFFTztBQUNMVSxzQkFBUWYsSUFBUixDQUFhSyxJQUFiO0FBQ0Q7QUFDRjtBQUNGO0FBQ0YsT0EzQkQsTUEyQk87QUFDTCxZQUFJekQsRUFBRXdFLHNCQUFGLENBQXlCeEIsSUFBekIsQ0FBSixFQUFvQztBQUNsQ29CLHNCQUFZaEIsSUFBWixDQUFpQkosSUFBakI7QUFDRCxTQUZELE1BRU87QUFDTG1CLGtCQUFRZixJQUFSLENBQWFKLElBQWI7QUFDRDtBQUNGO0FBQ0Y7QUFDRCxTQUFLbUIsT0FBTCxHQUFlLHFCQUFLQSxPQUFMLENBQWY7QUFDQSxTQUFLQyxXQUFMLEdBQW1CLHFCQUFLQSxXQUFMLENBQW5CO0FBQ0Q7O0FBRURLLGlCQUFlO0FBQ2IsUUFBSSxLQUFLTixPQUFMLElBQWdCLElBQXBCLEVBQTBCO0FBQ3hCO0FBQ0EsV0FBS3JDLE9BQUw7QUFDRDtBQUNELFdBQU8sS0FBS3FDLE9BQVo7QUFDRDs7QUFFRE8scUJBQW1CO0FBQ2pCLFFBQUksS0FBS04sV0FBTCxJQUFvQixJQUF4QixFQUE4QjtBQUM1QjtBQUNBLFdBQUt0QyxPQUFMO0FBQ0Q7QUFDRCxXQUFPLEtBQUtzQyxXQUFaO0FBQ0Q7O0FBRURPLFVBQVE7QUFDTixXQUFPLElBQUk3RSxFQUFFOEUsTUFBTixDQUFhO0FBQ2xCbkMsYUFBUSxLQUFLSSxPQUFOLENBQW9CbUIsTUFBcEIsQ0FBMkIsS0FBS3ZCLEtBQWhDLENBRFc7QUFFbEJFLGtCQUFZLEtBQUtBO0FBQ2pCO0FBSGtCLEtBQWIsRUFJSmtDLE1BSkksQ0FJRyxrQ0FBd0IsQ0FBeEIsQ0FKSCxDQUFQO0FBS0Q7O0FBRURDLFlBQVU7QUFDUixXQUFPLHVCQUFRLEtBQUtILEtBQUwsRUFBUixFQUFzQkksSUFBN0I7QUFDRDtBQTdLOEI7a0JBQVp6QyxXIiwiZmlsZSI6InN3ZWV0LW1vZHVsZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEBmbG93XG5pbXBvcnQgVGVybSwgKiBhcyBUIGZyb20gJ3N3ZWV0LXNwZWMnO1xuaW1wb3J0ICogYXMgXyBmcm9tICdyYW1kYSc7XG5pbXBvcnQgKiBhcyBTIGZyb20gJy4vc3dlZXQtc3BlYy11dGlscyc7XG5pbXBvcnQgY29kZWdlbiBmcm9tICcuL2NvZGVnZW4nO1xuaW1wb3J0IHsgTGlzdCB9IGZyb20gJ2ltbXV0YWJsZSc7XG5pbXBvcnQgU3dlZXRUb1NoaWZ0UmVkdWNlciBmcm9tICcuL3N3ZWV0LXRvLXNoaWZ0LXJlZHVjZXIuanMnO1xuaW1wb3J0IFN5bnRheCBmcm9tICcuL3N5bnRheCc7XG5cbmNvbnN0IGV4dHJhY3REZWNsYXJhdGlvbiA9IF8uY29uZChbXG4gIFtTLmlzRXhwb3J0LCBfLnByb3AoJ2RlY2xhcmF0aW9uJyldLFxuICBbUy5pc0V4cG9ydERlZmF1bHQsIF8ucHJvcCgnYm9keScpXSxcbiAgW1xuICAgIF8uVCxcbiAgICB0ZXJtID0+IHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0aW5nIGFuIEV4cG9ydCBvciBFeHBvcnREZWZhdWx0IGJ1dCBnb3QgJHt0ZXJtfWApO1xuICAgIH0sXG4gIF0sXG5dKTtcblxuY29uc3QgRXhwU3BlYyA9IHggPT4gKHtcbiAgZXhwb3J0ZWROYW1lOiB4LFxufSk7XG5cbmNvbnN0IGV4dHJhY3REZWNsYXJhdGlvbk5hbWVzID0gXy5jb25kKFtcbiAgW1MuaXNWYXJpYWJsZURlY2xhcmF0b3IsICh7IGJpbmRpbmcgfSkgPT4gTGlzdC5vZihiaW5kaW5nLm5hbWUpXSxcbiAgW1xuICAgIFMuaXNWYXJpYWJsZURlY2xhcmF0aW9uLFxuICAgICh7IGRlY2xhcmF0b3JzIH0pID0+IGRlY2xhcmF0b3JzLmZsYXRNYXAoZXh0cmFjdERlY2xhcmF0aW9uTmFtZXMpLFxuICBdLFxuICBbUy5pc0Z1bmN0aW9uRGVjbGFyYXRpb24sICh7IG5hbWUgfSkgPT4gTGlzdC5vZihuYW1lLm5hbWUpXSxcbiAgW1MuaXNDbGFzc0RlY2xhcmF0aW9uLCAoeyBuYW1lIH0pID0+IExpc3Qub2YobmFtZS5uYW1lKV0sXG5dKTtcblxuY29uc3QgZXh0cmFjdERlY2xhcmF0aW9uU3BlY2lmaWVycyA9IF8uY29uZChbXG4gIFtTLmlzVmFyaWFibGVEZWNsYXJhdG9yLCAoeyBiaW5kaW5nIH0pID0+IExpc3Qub2YoRXhwU3BlYyhiaW5kaW5nLm5hbWUpKV0sXG4gIFtcbiAgICBTLmlzVmFyaWFibGVEZWNsYXJhdGlvbixcbiAgICAoeyBkZWNsYXJhdG9ycyB9KSA9PiBkZWNsYXJhdG9ycy5mbGF0TWFwKGV4dHJhY3REZWNsYXJhdGlvblNwZWNpZmllcnMpLFxuICBdLFxuICBbUy5pc0Z1bmN0aW9uRGVjbGFyYXRpb24sICh7IG5hbWUgfSkgPT4gTGlzdC5vZihFeHBTcGVjKG5hbWUubmFtZSkpXSxcbiAgW1MuaXNDbGFzc0RlY2xhcmF0aW9uLCAoeyBuYW1lIH0pID0+IExpc3Qub2YoRXhwU3BlYyhuYW1lLm5hbWUpKV0sXG5dKTtcblxudHlwZSBFeHBvcnRTcGVjaWZpZXIgPSB7XG4gIG5hbWU/OiBTeW50YXgsXG4gIGV4cG9ydGVkTmFtZTogU3ludGF4LFxufTtcblxuZnVuY3Rpb24gZXh0cmFjdFNwZWNpZmllcnModGVybTogYW55KTogTGlzdDxFeHBvcnRTcGVjaWZpZXI+IHtcbiAgaWYgKFMuaXNFeHBvcnQodGVybSkpIHtcbiAgICByZXR1cm4gZXh0cmFjdERlY2xhcmF0aW9uU3BlY2lmaWVycyh0ZXJtLmRlY2xhcmF0aW9uKTtcbiAgfSBlbHNlIGlmIChTLmlzRXhwb3J0RGVmYXVsdCh0ZXJtKSkge1xuICAgIHJldHVybiBMaXN0KCk7XG4gIH0gZWxzZSBpZiAoUy5pc0V4cG9ydEZyb20odGVybSkpIHtcbiAgICByZXR1cm4gdGVybS5uYW1lZEV4cG9ydHM7XG4gIH0gZWxzZSBpZiAoUy5pc0V4cG9ydExvY2Fscyh0ZXJtKSkge1xuICAgIHJldHVybiB0ZXJtLm5hbWVkRXhwb3J0cy5tYXAoKHsgbmFtZSwgZXhwb3J0ZWROYW1lIH0pID0+ICh7XG4gICAgICBuYW1lOiBuYW1lID09IG51bGwgPyBudWxsIDogbmFtZS5uYW1lLFxuICAgICAgZXhwb3J0ZWROYW1lOiBleHBvcnRlZE5hbWUsXG4gICAgfSkpO1xuICB9XG4gIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBleHBvcnQgdHlwZWApO1xufVxuXG5mdW5jdGlvbiB3cmFwU3RhdGVtZW50KGRlY2xhcmF0aW9uOiBUZXJtKSB7XG4gIGlmIChTLmlzVmFyaWFibGVEZWNsYXJhdGlvbihkZWNsYXJhdGlvbikpIHtcbiAgICByZXR1cm4gbmV3IFQuVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudCh7XG4gICAgICBkZWNsYXJhdGlvbixcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gZGVjbGFyYXRpb247XG59XG5cbmNvbnN0IG1lbW9TeW0gPSBTeW1ib2woJ21lbW8nKTtcblxuZnVuY3Rpb24gbWFrZVZhckRlY2xTdG10KG5hbWU6IFQuQmluZGluZ0lkZW50aWZpZXIsIGV4cHI6IFQuRXhwcmVzc2lvbikge1xuICByZXR1cm4gbmV3IFQuVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudCh7XG4gICAgZGVjbGFyYXRpb246IG5ldyBULlZhcmlhYmxlRGVjbGFyYXRpb24oe1xuICAgICAga2luZDogJ3ZhcicsXG4gICAgICBkZWNsYXJhdG9yczogTGlzdC5vZihcbiAgICAgICAgbmV3IFQuVmFyaWFibGVEZWNsYXJhdG9yKHtcbiAgICAgICAgICBiaW5kaW5nOiBuYW1lLFxuICAgICAgICAgIGluaXQ6IGV4cHIsXG4gICAgICAgIH0pLFxuICAgICAgKSxcbiAgICB9KSxcbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFN3ZWV0TW9kdWxlIHtcbiAgcGF0aDogc3RyaW5nO1xuICBpdGVtczogTGlzdDxUZXJtPjtcbiAgZGlyZWN0aXZlczogTGlzdDxzdHJpbmc+O1xuICBpbXBvcnRzOiBMaXN0PFQuSW1wb3J0RGVjbGFyYXRpb24+O1xuICBleHBvcnRzOiBMaXN0PFQuRXhwb3J0RGVjbGFyYXRpb24+O1xuICBleHBvcnRlZE5hbWVzOiBMaXN0PEV4cG9ydFNwZWNpZmllcj47XG4gIGRlZmF1bHRFeHBvcnQ6IGFueTtcblxuICBydW50aW1lOiBMaXN0PFRlcm0+O1xuICBjb21waWxldGltZTogTGlzdDxUZXJtPjtcblxuICBjb25zdHJ1Y3RvcihwYXRoOiBzdHJpbmcsIGl0ZW1zOiBMaXN0PFRlcm0+KSB7XG4gICAgbGV0IG1vcmVEaXJlY3RpdmVzID0gdHJ1ZTtcbiAgICBsZXQgZGlyZWN0aXZlcyA9IFtdO1xuICAgIGxldCBib2R5ID0gW107XG4gICAgbGV0IGltcG9ydHMgPSBbXTtcbiAgICBsZXQgZXhwb3J0cyA9IFtdO1xuICAgIHRoaXMucGF0aCA9IHBhdGg7XG4gICAgdGhpcy5leHBvcnRlZE5hbWVzID0gTGlzdCgpO1xuICAgIGZvciAobGV0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgIGlmIChcbiAgICAgICAgbW9yZURpcmVjdGl2ZXMgJiZcbiAgICAgICAgaXRlbSBpbnN0YW5jZW9mIFQuRXhwcmVzc2lvblN0YXRlbWVudCAmJlxuICAgICAgICBpdGVtLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBULkxpdGVyYWxTdHJpbmdFeHByZXNzaW9uXG4gICAgICApIHtcbiAgICAgICAgZGlyZWN0aXZlcy5wdXNoKGl0ZW0uZXhwcmVzc2lvbi52YWx1ZSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbW9yZURpcmVjdGl2ZXMgPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBULkltcG9ydERlY2xhcmF0aW9uKSB7XG4gICAgICAgIGltcG9ydHMucHVzaChpdGVtKTtcbiAgICAgIH0gZWxzZSBpZiAoaXRlbSBpbnN0YW5jZW9mIFQuRXhwb3J0RGVjbGFyYXRpb24pIHtcbiAgICAgICAgaWYgKFMuaXNFeHBvcnQoaXRlbSkpIHtcbiAgICAgICAgICBsZXQgZGVjbCA9IGV4dHJhY3REZWNsYXJhdGlvbihpdGVtKTtcbiAgICAgICAgICBsZXQgc3RtdCA9IHdyYXBTdGF0ZW1lbnQoZGVjbCk7XG4gICAgICAgICAgbGV0IG5hbWVzID0gZXh0cmFjdERlY2xhcmF0aW9uTmFtZXMoZGVjbCk7XG4gICAgICAgICAgYm9keS5wdXNoKHN0bXQpO1xuICAgICAgICAgIC8vIFRPRE86IHN1cHBvcnQgRXhwb3J0RnJvbVxuICAgICAgICAgIGxldCBleHAgPSBuZXcgVC5FeHBvcnRMb2NhbHMoe1xuICAgICAgICAgICAgbW9kdWxlU3BlY2lmaWVyOiBudWxsLFxuICAgICAgICAgICAgbmFtZWRFeHBvcnRzOiBuYW1lcy5tYXAoXG4gICAgICAgICAgICAgIG5hbWUgPT5cbiAgICAgICAgICAgICAgICBuZXcgVC5FeHBvcnRMb2NhbFNwZWNpZmllcih7XG4gICAgICAgICAgICAgICAgICBuYW1lOiBuZXcgVC5JZGVudGlmaWVyRXhwcmVzc2lvbih7XG4gICAgICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICAgIGV4cG9ydGVkTmFtZTogbmFtZSxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYm9keS5wdXNoKGV4cCk7XG4gICAgICAgICAgZXhwb3J0cy5wdXNoKGV4cCk7XG4gICAgICAgICAgdGhpcy5leHBvcnRlZE5hbWVzID0gdGhpcy5leHBvcnRlZE5hbWVzLmNvbmNhdChcbiAgICAgICAgICAgIGV4dHJhY3RTcGVjaWZpZXJzKGV4cCksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmIChpdGVtIGluc3RhbmNlb2YgVC5FeHBvcnRMb2NhbHMpIHtcbiAgICAgICAgICBsZXQgZXhwID0gbmV3IFQuRXhwb3J0TG9jYWxzKHtcbiAgICAgICAgICAgIG5hbWVkRXhwb3J0czogaXRlbS5uYW1lZEV4cG9ydHMubWFwKCh7IG5hbWUsIGV4cG9ydGVkTmFtZSB9KSA9PiB7XG4gICAgICAgICAgICAgIGlmIChuYW1lID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFQuRXhwb3J0TG9jYWxTcGVjaWZpZXIoe1xuICAgICAgICAgICAgICAgICAgbmFtZTogbmV3IFQuSWRlbnRpZmllckV4cHJlc3Npb24oe1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBleHBvcnRlZE5hbWUsXG4gICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICAgIGV4cG9ydGVkTmFtZSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gbmV3IFQuRXhwb3J0TG9jYWxTcGVjaWZpZXIoe1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgZXhwb3J0ZWROYW1lLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGJvZHkucHVzaChleHApO1xuICAgICAgICAgIGV4cG9ydHMucHVzaChleHApO1xuICAgICAgICAgIHRoaXMuZXhwb3J0ZWROYW1lcyA9IHRoaXMuZXhwb3J0ZWROYW1lcy5jb25jYXQoXG4gICAgICAgICAgICBleHRyYWN0U3BlY2lmaWVycyhleHApLFxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZXhwb3J0cy5wdXNoKGl0ZW0pO1xuICAgICAgICAgIGJvZHkucHVzaChpdGVtKTtcbiAgICAgICAgICB0aGlzLmV4cG9ydGVkTmFtZXMgPSB0aGlzLmV4cG9ydGVkTmFtZXMuY29uY2F0KFxuICAgICAgICAgICAgZXh0cmFjdFNwZWNpZmllcnMoaXRlbSksXG4gICAgICAgICAgKTtcbiAgICAgICAgICBpZiAoUy5pc0V4cG9ydERlZmF1bHQoaXRlbSkpIHtcbiAgICAgICAgICAgIHRoaXMuZGVmYXVsdEV4cG9ydCA9IFN5bnRheC5mcm9tSWRlbnRpZmllcignX2RlZmF1bHQnKTtcbiAgICAgICAgICAgIHRoaXMuZXhwb3J0ZWROYW1lcyA9IHRoaXMuZXhwb3J0ZWROYW1lcy5wdXNoKFxuICAgICAgICAgICAgICBFeHBTcGVjKHRoaXMuZGVmYXVsdEV4cG9ydCksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYm9keS5wdXNoKGl0ZW0pO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLml0ZW1zID0gTGlzdChib2R5KTtcbiAgICB0aGlzLmltcG9ydHMgPSBMaXN0KGltcG9ydHMpO1xuICAgIHRoaXMuZXhwb3J0cyA9IExpc3QoZXhwb3J0cyk7XG4gICAgdGhpcy5kaXJlY3RpdmVzID0gTGlzdChkaXJlY3RpdmVzKTtcbiAgfVxuXG4gIC8vICRGbG93Rml4TWU6IGZsb3cgZG9lc24ndCBzdXBwb3J0IGNvbXB1dGVkIHByb3BlcnR5IGtleXMgeWV0XG4gIFttZW1vU3ltXSgpIHtcbiAgICBsZXQgcnVudGltZSA9IFtdLFxuICAgICAgY29tcGlsZXRpbWUgPSBbXTtcbiAgICBmb3IgKGxldCBpdGVtIG9mIHRoaXMuaXRlbXMpIHtcbiAgICAgIGlmIChTLmlzRXhwb3J0RGVjbGFyYXRpb24oaXRlbSkpIHtcbiAgICAgICAgaWYgKFMuaXNFeHBvcnREZWZhdWx0KGl0ZW0pKSB7XG4gICAgICAgICAgbGV0IGRlY2wgPSBleHRyYWN0RGVjbGFyYXRpb24oaXRlbSk7XG4gICAgICAgICAgbGV0IGRlZiA9IG5ldyBULkJpbmRpbmdJZGVudGlmaWVyKHtcbiAgICAgICAgICAgIG5hbWU6IHRoaXMuZGVmYXVsdEV4cG9ydCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoUy5pc0Z1bmN0aW9uRGVjbGFyYXRpb24oZGVjbCkgfHwgUy5pc0NsYXNzRGVjbGFyYXRpb24oZGVjbCkpIHtcbiAgICAgICAgICAgIHJ1bnRpbWUucHVzaChkZWNsKTtcbiAgICAgICAgICAgIC8vIGV4dHJhY3QgbmFtZSBhbmQgYmluZCBpdCB0byBfZGVmYXVsdFxuICAgICAgICAgICAgcnVudGltZS5wdXNoKFxuICAgICAgICAgICAgICBtYWtlVmFyRGVjbFN0bXQoXG4gICAgICAgICAgICAgICAgZGVmLFxuICAgICAgICAgICAgICAgIG5ldyBULklkZW50aWZpZXJFeHByZXNzaW9uKHtcbiAgICAgICAgICAgICAgICAgIG5hbWU6IGRlY2wubmFtZS5uYW1lLFxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZXhwcmVzc2lvbiBzbyBiaW5kIGl0IHRvIF9kZWZhdWx0XG4gICAgICAgICAgICBsZXQgc3RtdCA9IG1ha2VWYXJEZWNsU3RtdChkZWYsIGRlY2wpO1xuICAgICAgICAgICAgaWYgKFMuaXNDb21waWxldGltZVN0YXRlbWVudChzdG10KSkge1xuICAgICAgICAgICAgICBjb21waWxldGltZS5wdXNoKHN0bXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcnVudGltZS5wdXNoKHN0bXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKFMuaXNDb21waWxldGltZVN0YXRlbWVudChpdGVtKSkge1xuICAgICAgICAgIGNvbXBpbGV0aW1lLnB1c2goaXRlbSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcnVudGltZS5wdXNoKGl0ZW0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMucnVudGltZSA9IExpc3QocnVudGltZSk7XG4gICAgdGhpcy5jb21waWxldGltZSA9IExpc3QoY29tcGlsZXRpbWUpO1xuICB9XG5cbiAgcnVudGltZUl0ZW1zKCkge1xuICAgIGlmICh0aGlzLnJ1bnRpbWUgPT0gbnVsbCkge1xuICAgICAgLy8gJEZsb3dGaXhNZTogZmxvdyBkb2Vzbid0IHN1cHBvcnQgY29tcHV0ZWQgcHJvcGVydHkga2V5cyB5ZXRcbiAgICAgIHRoaXNbbWVtb1N5bV0oKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucnVudGltZTtcbiAgfVxuXG4gIGNvbXBpbGV0aW1lSXRlbXMoKSB7XG4gICAgaWYgKHRoaXMuY29tcGlsZXRpbWUgPT0gbnVsbCkge1xuICAgICAgLy8gJEZsb3dGaXhNZTogZmxvdyBkb2Vzbid0IHN1cHBvcnQgY29tcHV0ZWQgcHJvcGVydHkga2V5cyB5ZXRcbiAgICAgIHRoaXNbbWVtb1N5bV0oKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZXRpbWU7XG4gIH1cblxuICBwYXJzZSgpIHtcbiAgICByZXR1cm4gbmV3IFQuTW9kdWxlKHtcbiAgICAgIGl0ZW1zOiAodGhpcy5pbXBvcnRzOiBhbnkpLmNvbmNhdCh0aGlzLml0ZW1zKSxcbiAgICAgIGRpcmVjdGl2ZXM6IHRoaXMuZGlyZWN0aXZlcyxcbiAgICAgIC8vICRGbG93Rml4TWU6IGZsb3cgZG9lc24ndCBrbm93IGFib3V0IHJlZHVjZSB5ZXRcbiAgICB9KS5yZWR1Y2UobmV3IFN3ZWV0VG9TaGlmdFJlZHVjZXIoMCkpO1xuICB9XG5cbiAgY29kZWdlbigpIHtcbiAgICByZXR1cm4gY29kZWdlbih0aGlzLnBhcnNlKCkpLmNvZGU7XG4gIH1cbn1cbiJdfQ==