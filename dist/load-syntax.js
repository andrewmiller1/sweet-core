'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.expandCompiletime = expandCompiletime;
exports.sanitizeReplacementValues = sanitizeReplacementValues;
exports.evalCompiletimeValue = evalCompiletimeValue;

var _sweetSpec = require('sweet-spec');

var S = _interopRequireWildcard(_sweetSpec);

var _ramda = require('ramda');

var _ = _interopRequireWildcard(_ramda);

var _immutable = require('immutable');

var _syntax = require('./syntax');

var _syntax2 = _interopRequireDefault(_syntax);

var _shiftCodegen = require('shift-codegen');

var _shiftCodegen2 = _interopRequireDefault(_shiftCodegen);

var _sweetToShiftReducer = require('./sweet-to-shift-reducer');

var _sweetToShiftReducer2 = _interopRequireDefault(_sweetToShiftReducer);

var _termExpander = require('./term-expander');

var _termExpander2 = _interopRequireDefault(_termExpander);

var _env = require('./env');

var _env2 = _interopRequireDefault(_env);

var _templateProcessor = require('./template-processor');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function expandCompiletime(term, context) {
  // each compiletime value needs to be expanded with a fresh
  // environment and in the next higher phase
  let syntaxExpander = new _termExpander2.default(_.merge(context, {
    phase: context.phase + 1,
    env: new _env2.default(),
    store: context.store
  }));

  return syntaxExpander.expand(term);
}

function sanitizeReplacementValues(values) {
  if (Array.isArray(values)) {
    return sanitizeReplacementValues((0, _immutable.List)(values));
  } else if (_immutable.List.isList(values)) {
    return values.map(sanitizeReplacementValues);
  } else if (values == null) {
    throw new Error('replacement values for syntax template must not be null or undefined');
  } else if (typeof values.next === 'function') {
    return sanitizeReplacementValues((0, _immutable.List)(values));
  }
  return values;
}

// (Expression, Context) -> [function]
function evalCompiletimeValue(expr, context) {
  let sandbox = {
    syntaxTemplate: function (ident, ...values) {
      return (0, _templateProcessor.replaceTemplate)(context.templateMap.get(ident), sanitizeReplacementValues(values));
    }
  };

  let sandboxKeys = (0, _immutable.List)(Object.keys(sandbox));
  let sandboxVals = sandboxKeys.map(k => sandbox[k]).toArray();

  let parsed = new S.Module({
    directives: (0, _immutable.List)(),
    items: _immutable.List.of(new S.ExpressionStatement({
      expression: new S.FunctionExpression({
        isAsync: false,
        isGenerator: false,
        name: null,
        params: new S.FormalParameters({
          items: sandboxKeys.map(param => {
            return new S.BindingIdentifier({
              name: _syntax2.default.from('identifier', param)
            });
          }),
          rest: null
        }),
        body: new S.FunctionBody({
          directives: _immutable.List.of(new S.Directive({
            rawValue: 'use strict'
          })),
          statements: _immutable.List.of(new S.ReturnStatement({
            expression: expr
          }))
        })
      })
    }))
  }).reduce(new _sweetToShiftReducer2.default(context.phase));

  let gen = (0, _shiftCodegen2.default)(parsed, new _shiftCodegen.FormattedCodeGen());
  let result = context.transform(gen);

  let val = context.loader.eval(result.code, context.store);
  return val.apply(undefined, sandboxVals);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9sb2FkLXN5bnRheC5qcyJdLCJuYW1lcyI6WyJleHBhbmRDb21waWxldGltZSIsInNhbml0aXplUmVwbGFjZW1lbnRWYWx1ZXMiLCJldmFsQ29tcGlsZXRpbWVWYWx1ZSIsIlMiLCJfIiwidGVybSIsImNvbnRleHQiLCJzeW50YXhFeHBhbmRlciIsIm1lcmdlIiwicGhhc2UiLCJlbnYiLCJzdG9yZSIsImV4cGFuZCIsInZhbHVlcyIsIkFycmF5IiwiaXNBcnJheSIsImlzTGlzdCIsIm1hcCIsIkVycm9yIiwibmV4dCIsImV4cHIiLCJzYW5kYm94Iiwic3ludGF4VGVtcGxhdGUiLCJpZGVudCIsInRlbXBsYXRlTWFwIiwiZ2V0Iiwic2FuZGJveEtleXMiLCJPYmplY3QiLCJrZXlzIiwic2FuZGJveFZhbHMiLCJrIiwidG9BcnJheSIsInBhcnNlZCIsIk1vZHVsZSIsImRpcmVjdGl2ZXMiLCJpdGVtcyIsIm9mIiwiRXhwcmVzc2lvblN0YXRlbWVudCIsImV4cHJlc3Npb24iLCJGdW5jdGlvbkV4cHJlc3Npb24iLCJpc0FzeW5jIiwiaXNHZW5lcmF0b3IiLCJuYW1lIiwicGFyYW1zIiwiRm9ybWFsUGFyYW1ldGVycyIsInBhcmFtIiwiQmluZGluZ0lkZW50aWZpZXIiLCJmcm9tIiwicmVzdCIsImJvZHkiLCJGdW5jdGlvbkJvZHkiLCJEaXJlY3RpdmUiLCJyYXdWYWx1ZSIsInN0YXRlbWVudHMiLCJSZXR1cm5TdGF0ZW1lbnQiLCJyZWR1Y2UiLCJnZW4iLCJyZXN1bHQiLCJ0cmFuc2Zvcm0iLCJ2YWwiLCJsb2FkZXIiLCJldmFsIiwiY29kZSIsImFwcGx5IiwidW5kZWZpbmVkIl0sIm1hcHBpbmdzIjoiOzs7OztRQVdnQkEsaUIsR0FBQUEsaUI7UUFjQUMseUIsR0FBQUEseUI7UUFnQkFDLG9CLEdBQUFBLG9COztBQXpDaEI7O0lBQVlDLEM7O0FBQ1o7O0lBQVlDLEM7O0FBQ1o7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7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aUNBLE1BQUkrQyxNQUFNLDRCQUFReEIsTUFBUixFQUFnQixvQ0FBaEIsQ0FBVjtBQUNBLE1BQUl5QixTQUFTbkQsUUFBUW9ELFNBQVIsQ0FBa0JGLEdBQWxCLENBQWI7O0FBRUEsTUFBSUcsTUFBTXJELFFBQVFzRCxNQUFSLENBQWVDLElBQWYsQ0FBb0JKLE9BQU9LLElBQTNCLEVBQWlDeEQsUUFBUUssS0FBekMsQ0FBVjtBQUNBLFNBQU9nRCxJQUFJSSxLQUFKLENBQVVDLFNBQVYsRUFBcUJuQyxXQUFyQixDQUFQO0FBQ0QiLCJmaWxlIjoibG9hZC1zeW50YXguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBTIGZyb20gJ3N3ZWV0LXNwZWMnO1xuaW1wb3J0ICogYXMgXyBmcm9tICdyYW1kYSc7XG5pbXBvcnQgeyBMaXN0IH0gZnJvbSAnaW1tdXRhYmxlJztcbmltcG9ydCBTeW50YXggZnJvbSAnLi9zeW50YXgnO1xuaW1wb3J0IGNvZGVnZW4sIHsgRm9ybWF0dGVkQ29kZUdlbiB9IGZyb20gJ3NoaWZ0LWNvZGVnZW4nO1xuaW1wb3J0IFN3ZWV0VG9TaGlmdFJlZHVjZXIgZnJvbSAnLi9zd2VldC10by1zaGlmdC1yZWR1Y2VyJztcbmltcG9ydCBUZXJtRXhwYW5kZXIgZnJvbSAnLi90ZXJtLWV4cGFuZGVyJztcbmltcG9ydCBFbnYgZnJvbSAnLi9lbnYnO1xuXG5pbXBvcnQgeyByZXBsYWNlVGVtcGxhdGUgfSBmcm9tICcuL3RlbXBsYXRlLXByb2Nlc3Nvcic7XG5cbmV4cG9ydCBmdW5jdGlvbiBleHBhbmRDb21waWxldGltZSh0ZXJtLCBjb250ZXh0KSB7XG4gIC8vIGVhY2ggY29tcGlsZXRpbWUgdmFsdWUgbmVlZHMgdG8gYmUgZXhwYW5kZWQgd2l0aCBhIGZyZXNoXG4gIC8vIGVudmlyb25tZW50IGFuZCBpbiB0aGUgbmV4dCBoaWdoZXIgcGhhc2VcbiAgbGV0IHN5bnRheEV4cGFuZGVyID0gbmV3IFRlcm1FeHBhbmRlcihcbiAgICBfLm1lcmdlKGNvbnRleHQsIHtcbiAgICAgIHBoYXNlOiBjb250ZXh0LnBoYXNlICsgMSxcbiAgICAgIGVudjogbmV3IEVudigpLFxuICAgICAgc3RvcmU6IGNvbnRleHQuc3RvcmUsXG4gICAgfSksXG4gICk7XG5cbiAgcmV0dXJuIHN5bnRheEV4cGFuZGVyLmV4cGFuZCh0ZXJtKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNhbml0aXplUmVwbGFjZW1lbnRWYWx1ZXModmFsdWVzKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlcykpIHtcbiAgICByZXR1cm4gc2FuaXRpemVSZXBsYWNlbWVudFZhbHVlcyhMaXN0KHZhbHVlcykpO1xuICB9IGVsc2UgaWYgKExpc3QuaXNMaXN0KHZhbHVlcykpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcChzYW5pdGl6ZVJlcGxhY2VtZW50VmFsdWVzKTtcbiAgfSBlbHNlIGlmICh2YWx1ZXMgPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdyZXBsYWNlbWVudCB2YWx1ZXMgZm9yIHN5bnRheCB0ZW1wbGF0ZSBtdXN0IG5vdCBiZSBudWxsIG9yIHVuZGVmaW5lZCcsXG4gICAgKTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWVzLm5leHQgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gc2FuaXRpemVSZXBsYWNlbWVudFZhbHVlcyhMaXN0KHZhbHVlcykpO1xuICB9XG4gIHJldHVybiB2YWx1ZXM7XG59XG5cbi8vIChFeHByZXNzaW9uLCBDb250ZXh0KSAtPiBbZnVuY3Rpb25dXG5leHBvcnQgZnVuY3Rpb24gZXZhbENvbXBpbGV0aW1lVmFsdWUoZXhwcjogUy5FeHByZXNzaW9uLCBjb250ZXh0OiBhbnkpIHtcbiAgbGV0IHNhbmRib3ggPSB7XG4gICAgc3ludGF4VGVtcGxhdGU6IGZ1bmN0aW9uKGlkZW50LCAuLi52YWx1ZXMpIHtcbiAgICAgIHJldHVybiByZXBsYWNlVGVtcGxhdGUoXG4gICAgICAgIGNvbnRleHQudGVtcGxhdGVNYXAuZ2V0KGlkZW50KSxcbiAgICAgICAgc2FuaXRpemVSZXBsYWNlbWVudFZhbHVlcyh2YWx1ZXMpLFxuICAgICAgKTtcbiAgICB9LFxuICB9O1xuXG4gIGxldCBzYW5kYm94S2V5cyA9IExpc3QoT2JqZWN0LmtleXMoc2FuZGJveCkpO1xuICBsZXQgc2FuZGJveFZhbHMgPSBzYW5kYm94S2V5cy5tYXAoayA9PiBzYW5kYm94W2tdKS50b0FycmF5KCk7XG5cbiAgbGV0IHBhcnNlZCA9IG5ldyBTLk1vZHVsZSh7XG4gICAgZGlyZWN0aXZlczogTGlzdCgpLFxuICAgIGl0ZW1zOiBMaXN0Lm9mKFxuICAgICAgbmV3IFMuRXhwcmVzc2lvblN0YXRlbWVudCh7XG4gICAgICAgIGV4cHJlc3Npb246IG5ldyBTLkZ1bmN0aW9uRXhwcmVzc2lvbih7XG4gICAgICAgICAgaXNBc3luYzogZmFsc2UsXG4gICAgICAgICAgaXNHZW5lcmF0b3I6IGZhbHNlLFxuICAgICAgICAgIG5hbWU6IG51bGwsXG4gICAgICAgICAgcGFyYW1zOiBuZXcgUy5Gb3JtYWxQYXJhbWV0ZXJzKHtcbiAgICAgICAgICAgIGl0ZW1zOiBzYW5kYm94S2V5cy5tYXAocGFyYW0gPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gbmV3IFMuQmluZGluZ0lkZW50aWZpZXIoe1xuICAgICAgICAgICAgICAgIG5hbWU6IFN5bnRheC5mcm9tKCdpZGVudGlmaWVyJywgcGFyYW0pLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgcmVzdDogbnVsbCxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBib2R5OiBuZXcgUy5GdW5jdGlvbkJvZHkoe1xuICAgICAgICAgICAgZGlyZWN0aXZlczogTGlzdC5vZihcbiAgICAgICAgICAgICAgbmV3IFMuRGlyZWN0aXZlKHtcbiAgICAgICAgICAgICAgICByYXdWYWx1ZTogJ3VzZSBzdHJpY3QnLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBzdGF0ZW1lbnRzOiBMaXN0Lm9mKFxuICAgICAgICAgICAgICBuZXcgUy5SZXR1cm5TdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgIGV4cHJlc3Npb246IGV4cHIsXG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSksXG4gICAgICB9KSxcbiAgICApLFxuICB9KS5yZWR1Y2UobmV3IFN3ZWV0VG9TaGlmdFJlZHVjZXIoY29udGV4dC5waGFzZSkpO1xuXG4gIGxldCBnZW4gPSBjb2RlZ2VuKHBhcnNlZCwgbmV3IEZvcm1hdHRlZENvZGVHZW4oKSk7XG4gIGxldCByZXN1bHQgPSBjb250ZXh0LnRyYW5zZm9ybShnZW4pO1xuXG4gIGxldCB2YWwgPSBjb250ZXh0LmxvYWRlci5ldmFsKHJlc3VsdC5jb2RlLCBjb250ZXh0LnN0b3JlKTtcbiAgcmV0dXJuIHZhbC5hcHBseSh1bmRlZmluZWQsIHNhbmRib3hWYWxzKTtcbn1cbiJdfQ==