'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isBoundToCompiletime = isBoundToCompiletime;
exports.bindImports = bindImports;

var _loadSyntax = require('./load-syntax');

var _ramda = require('ramda');

var _ = _interopRequireWildcard(_ramda);

var _sweetSpec = require('sweet-spec');

var T = _interopRequireWildcard(_sweetSpec);

var _sweetSpecUtils = require('./sweet-spec-utils');

var S = _interopRequireWildcard(_sweetSpecUtils);

var _symbol = require('./symbol');

var _transforms = require('./transforms');

var _hygieneUtils = require('./hygiene-utils');

var _sweetModule = require('./sweet-module');

var _sweetModule2 = _interopRequireDefault(_sweetModule);

var _immutable = require('immutable');

var _sweetToShiftReducer = require('./sweet-to-shift-reducer');

var _sweetToShiftReducer2 = _interopRequireDefault(_sweetToShiftReducer);

var _shiftCodegen = require('shift-codegen');

var _shiftCodegen2 = _interopRequireDefault(_shiftCodegen);

var _syntax = require('./syntax');

var _syntax2 = _interopRequireDefault(_syntax);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function isBoundToCompiletime(name, store) {
  let resolvedName = name.resolve(0);
  if (store.has(resolvedName)) {
    return store.get(resolvedName) instanceof _transforms.CompiletimeTransform;
  }
  return false;
}

function bindImports(impTerm, exModule, phase, context, isEntrypoint) {
  let names = [];
  let phaseToBind = impTerm.forSyntax ? phase + 1 : phase;
  if (impTerm.defaultBinding != null && impTerm instanceof T.Import) {
    let name = impTerm.defaultBinding.name;
    let exportName = exModule.exportedNames.find(exName => exName.exportedName.val() === '_default');
    if (exportName != null) {
      let newBinding = (0, _symbol.gensym)('_default');
      let toForward = exportName.exportedName;

      if (!isEntrypoint || isBoundToCompiletime(toForward, context.store) || impTerm.forSyntax) {
        context.bindings.addForward(name, toForward, newBinding, phaseToBind);
      }
      names.push(name);
    }
  }
  if (impTerm.namedImports) {
    impTerm.namedImports.forEach(specifier => {
      let name = specifier.binding.name;
      let exportName = exModule.exportedNames.find(exName => {
        if (exName.exportedName != null) {
          return exName.exportedName.val() === name.val();
        }
        return exName.name && exName.name.val() === name.val();
      });
      if (exportName != null) {
        let newBinding = (0, _symbol.gensym)(name.val());
        let toForward = exportName.name ? exportName.name : exportName.exportedName;
        if (!isEntrypoint || isBoundToCompiletime(toForward, context.store) || impTerm.forSyntax) {
          context.bindings.addForward(name, toForward, newBinding, phaseToBind);
        }
        names.push(name);
      }
    });
  }
  if (impTerm.namespaceBinding) {
    let name = impTerm.namespaceBinding.name;
    let newBinding = (0, _symbol.gensym)(name.val());
    context.store.set(newBinding.toString(), new _transforms.ModuleNamespaceTransform(name, exModule));
    context.bindings.add(name, {
      binding: newBinding,
      phase: phaseToBind,
      skipDup: false
    });

    names.push(name);
  }
  return (0, _immutable.List)(names);
}

exports.default = class {

  constructor(context) {
    this.context = context;
  }

  visit(mod, phase, store, cwd) {
    mod.imports.forEach(imp => {
      if (imp.forSyntax) {
        let mod = this.context.loader.get(imp.moduleSpecifier.val(), phase + 1, cwd);
        this.visit(mod, phase + 1, store, mod.path);
        this.invoke(mod, phase + 1, store, mod.path);
      } else {
        let mod = this.context.loader.get(imp.moduleSpecifier.val(), phase, cwd);
        this.visit(mod, phase, store, mod.path);
      }
      bindImports(imp, mod, phase, this.context, false);
    });
    for (let term of mod.compiletimeItems()) {
      if (S.isSyntaxDeclarationStatement(term)) {
        this.registerSyntaxDeclaration(term.declaration, phase, store);
      }
    }
    return store;
  }

  invoke(mod, phase, store, cwd) {
    if (this.context.invokedRegistry.containsAt(mod.path, phase)) {
      return store;
    }
    mod.imports.forEach(imp => {
      if (!imp.forSyntax) {
        let mod = this.context.loader.get(imp.moduleSpecifier.val(), phase, cwd);
        this.invoke(mod, phase, store, mod.path);
        bindImports(imp, mod, phase, this.context, false);
      }
    });
    let items = mod.runtimeItems();
    for (let term of items) {
      if (S.isVariableDeclarationStatement(term)) {
        this.registerVariableDeclaration(term.declaration, phase, store);
      } else if (S.isFunctionDeclaration(term)) {
        this.registerFunctionOrClass(term, phase, store);
      }
    }
    let parsed = new T.Module({
      directives: (0, _immutable.List)(),
      items
      // $FlowFixMe: flow doesn't know about reduce yet
    }).reduce(new _sweetToShiftReducer2.default(phase));

    let gen = (0, _shiftCodegen2.default)(parsed, new _shiftCodegen.FormattedCodeGen());
    let result = this.context.transform(gen);

    this.context.loader.eval(result.code, store);
    this.context.invokedRegistry.add(mod.path, phase);
    return store;
  }

  registerSyntaxDeclaration(term, phase, store) {
    term.declarators.forEach(decl => {
      let val = (0, _loadSyntax.evalCompiletimeValue)(decl.init, _.merge(this.context, {
        phase: phase + 1,
        store
      }));

      (0, _hygieneUtils.collectBindings)(decl.binding).forEach(stx => {
        if (phase !== 0) {
          // phase 0 bindings extend the binding map during compilation
          let newBinding = (0, _symbol.gensym)(stx.val());
          this.context.bindings.add(stx, {
            binding: newBinding,
            phase: phase,
            skipDup: false
          });
        }
        let resolvedName = stx.resolve(phase);
        let compiletimeType = term.kind === 'operator' ? 'operator' : 'syntax';
        store.set(resolvedName, new _transforms.CompiletimeTransform({
          type: compiletimeType,
          prec: decl.prec == null ? void 0 : decl.prec.val(),
          assoc: decl.assoc == null ? void 0 : decl.assoc.val(),
          f: val
        }));
      });
    });
  }

  registerVariableDeclaration(term, phase, store) {
    term.declarators.forEach(decl => {
      (0, _hygieneUtils.collectBindings)(decl.binding).forEach(stx => {
        if (phase !== 0) {
          // phase 0 bindings extend the binding map during compilation
          let newBinding = (0, _symbol.gensym)(stx.val());
          this.context.bindings.add(stx, {
            binding: newBinding,
            phase: phase,
            skipDup: term.kind === 'var'
          });
        }
      });
    });
  }

  registerFunctionOrClass(term, phase, store) {
    (0, _hygieneUtils.collectBindings)(term.name).forEach(stx => {
      if (phase !== 0) {
        let newBinding = (0, _symbol.gensym)(stx.val());
        this.context.bindings.add(stx, {
          binding: newBinding,
          phase: phase,
          skipDup: false
        });
      }
    });
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9tb2R1bGUtdmlzaXRvci5qcyJdLCJuYW1lcyI6WyJpc0JvdW5kVG9Db21waWxldGltZSIsImJpbmRJbXBvcnRzIiwiXyIsIlQiLCJTIiwibmFtZSIsInN0b3JlIiwicmVzb2x2ZWROYW1lIiwicmVzb2x2ZSIsImhhcyIsImdldCIsImltcFRlcm0iLCJleE1vZHVsZSIsInBoYXNlIiwiY29udGV4dCIsImlzRW50cnlwb2ludCIsIm5hbWVzIiwicGhhc2VUb0JpbmQiLCJmb3JTeW50YXgiLCJkZWZhdWx0QmluZGluZyIsIkltcG9ydCIsImV4cG9ydE5hbWUiLCJleHBvcnRlZE5hbWVzIiwiZmluZCIsImV4TmFtZSIsImV4cG9ydGVkTmFtZSIsInZhbCIsIm5ld0JpbmRpbmciLCJ0b0ZvcndhcmQiLCJiaW5kaW5ncyIsImFkZEZvcndhcmQiLCJwdXNoIiwibmFtZWRJbXBvcnRzIiwiZm9yRWFjaCIsInNwZWNpZmllciIsImJpbmRpbmciLCJuYW1lc3BhY2VCaW5kaW5nIiwic2V0IiwidG9TdHJpbmciLCJhZGQiLCJza2lwRHVwIiwiY29uc3RydWN0b3IiLCJ2aXNpdCIsIm1vZCIsImN3ZCIsImltcG9ydHMiLCJpbXAiLCJsb2FkZXIiLCJtb2R1bGVTcGVjaWZpZXIiLCJwYXRoIiwiaW52b2tlIiwidGVybSIsImNvbXBpbGV0aW1lSXRlbXMiLCJpc1N5bnRheERlY2xhcmF0aW9uU3RhdGVtZW50IiwicmVnaXN0ZXJTeW50YXhEZWNsYXJhdGlvbiIsImRlY2xhcmF0aW9uIiwiaW52b2tlZFJlZ2lzdHJ5IiwiY29udGFpbnNBdCIsIml0ZW1zIiwicnVudGltZUl0ZW1zIiwiaXNWYXJpYWJsZURlY2xhcmF0aW9uU3RhdGVtZW50IiwicmVnaXN0ZXJWYXJpYWJsZURlY2xhcmF0aW9uIiwiaXNGdW5jdGlvbkRlY2xhcmF0aW9uIiwicmVnaXN0ZXJGdW5jdGlvbk9yQ2xhc3MiLCJwYXJzZWQiLCJNb2R1bGUiLCJkaXJlY3RpdmVzIiwicmVkdWNlIiwiZ2VuIiwicmVzdWx0IiwidHJhbnNmb3JtIiwiZXZhbCIsImNvZGUiLCJkZWNsYXJhdG9ycyIsImRlY2wiLCJpbml0IiwibWVyZ2UiLCJzdHgiLCJjb21waWxldGltZVR5cGUiLCJraW5kIiwidHlwZSIsInByZWMiLCJhc3NvYyIsImYiXSwibWFwcGluZ3MiOiI7Ozs7O1FBZ0JnQkEsb0IsR0FBQUEsb0I7UUFRQUMsVyxHQUFBQSxXOztBQXZCaEI7O0FBQ0E7O0lBQVlDLEM7O0FBQ1o7O0lBQVlDLEM7O0FBQ1o7O0lBQVlDLEM7O0FBQ1o7O0FBQ0E7O0FBQ0E7O0FBQ0E7Ozs7QUFDQTs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7O0FBSU8sU0FBU0osb0JBQVQsQ0FBOEJLLElBQTlCLEVBQTRDQyxLQUE1QyxFQUE4RDtBQUNuRSxNQUFJQyxlQUFlRixLQUFLRyxPQUFMLENBQWEsQ0FBYixDQUFuQjtBQUNBLE1BQUlGLE1BQU1HLEdBQU4sQ0FBVUYsWUFBVixDQUFKLEVBQTZCO0FBQzNCLFdBQU9ELE1BQU1JLEdBQU4sQ0FBVUgsWUFBViw2Q0FBUDtBQUNEO0FBQ0QsU0FBTyxLQUFQO0FBQ0Q7O0FBRU0sU0FBU04sV0FBVCxDQUNMVSxPQURLLEVBRUxDLFFBRkssRUFHTEMsS0FISyxFQUlMQyxPQUpLLEVBS0xDLFlBTEssRUFNTDtBQUNBLE1BQUlDLFFBQVEsRUFBWjtBQUNBLE1BQUlDLGNBQWNOLFFBQVFPLFNBQVIsR0FBb0JMLFFBQVEsQ0FBNUIsR0FBZ0NBLEtBQWxEO0FBQ0EsTUFBSUYsUUFBUVEsY0FBUixJQUEwQixJQUExQixJQUFrQ1IsbUJBQW1CUixFQUFFaUIsTUFBM0QsRUFBbUU7QUFDakUsUUFBSWYsT0FBT00sUUFBUVEsY0FBUixDQUF1QmQsSUFBbEM7QUFDQSxRQUFJZ0IsYUFBYVQsU0FBU1UsYUFBVCxDQUF1QkMsSUFBdkIsQ0FDZkMsVUFBVUEsT0FBT0MsWUFBUCxDQUFvQkMsR0FBcEIsT0FBOEIsVUFEekIsQ0FBakI7QUFHQSxRQUFJTCxjQUFjLElBQWxCLEVBQXdCO0FBQ3RCLFVB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bmltcG9ydCB7IGV2YWxDb21waWxldGltZVZhbHVlIH0gZnJvbSAnLi9sb2FkLXN5bnRheCc7XG5pbXBvcnQgKiBhcyBfIGZyb20gJ3JhbWRhJztcbmltcG9ydCAqIGFzIFQgZnJvbSAnc3dlZXQtc3BlYyc7XG5pbXBvcnQgKiBhcyBTIGZyb20gJy4vc3dlZXQtc3BlYy11dGlscyc7XG5pbXBvcnQgeyBnZW5zeW0gfSBmcm9tICcuL3N5bWJvbCc7XG5pbXBvcnQgeyBNb2R1bGVOYW1lc3BhY2VUcmFuc2Zvcm0sIENvbXBpbGV0aW1lVHJhbnNmb3JtIH0gZnJvbSAnLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7IGNvbGxlY3RCaW5kaW5ncyB9IGZyb20gJy4vaHlnaWVuZS11dGlscyc7XG5pbXBvcnQgU3dlZXRNb2R1bGUgZnJvbSAnLi9zd2VldC1tb2R1bGUnO1xuaW1wb3J0IHsgTGlzdCB9IGZyb20gJ2ltbXV0YWJsZSc7XG5pbXBvcnQgU3dlZXRUb1NoaWZ0UmVkdWNlciBmcm9tICcuL3N3ZWV0LXRvLXNoaWZ0LXJlZHVjZXInO1xuaW1wb3J0IGNvZGVnZW4sIHsgRm9ybWF0dGVkQ29kZUdlbiB9IGZyb20gJ3NoaWZ0LWNvZGVnZW4nO1xuaW1wb3J0IFN5bnRheCBmcm9tICcuL3N5bnRheCc7XG5cbmltcG9ydCB0eXBlIHsgQ29udGV4dCB9IGZyb20gJy4vc3dlZXQtbG9hZGVyJztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzQm91bmRUb0NvbXBpbGV0aW1lKG5hbWU6IFN5bnRheCwgc3RvcmU6IE1hcDwqLCAqPikge1xuICBsZXQgcmVzb2x2ZWROYW1lID0gbmFtZS5yZXNvbHZlKDApO1xuICBpZiAoc3RvcmUuaGFzKHJlc29sdmVkTmFtZSkpIHtcbiAgICByZXR1cm4gc3RvcmUuZ2V0KHJlc29sdmVkTmFtZSkgaW5zdGFuY2VvZiBDb21waWxldGltZVRyYW5zZm9ybTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kSW1wb3J0cyhcbiAgaW1wVGVybTogYW55LFxuICBleE1vZHVsZTogU3dlZXRNb2R1bGUsXG4gIHBoYXNlOiBhbnksXG4gIGNvbnRleHQ6IENvbnRleHQsXG4gIGlzRW50cnlwb2ludDogYm9vbGVhbixcbikge1xuICBsZXQgbmFtZXMgPSBbXTtcbiAgbGV0IHBoYXNlVG9CaW5kID0gaW1wVGVybS5mb3JTeW50YXggPyBwaGFzZSArIDEgOiBwaGFzZTtcbiAgaWYgKGltcFRlcm0uZGVmYXVsdEJpbmRpbmcgIT0gbnVsbCAmJiBpbXBUZXJtIGluc3RhbmNlb2YgVC5JbXBvcnQpIHtcbiAgICBsZXQgbmFtZSA9IGltcFRlcm0uZGVmYXVsdEJpbmRpbmcubmFtZTtcbiAgICBsZXQgZXhwb3J0TmFtZSA9IGV4TW9kdWxlLmV4cG9ydGVkTmFtZXMuZmluZChcbiAgICAgIGV4TmFtZSA9PiBleE5hbWUuZXhwb3J0ZWROYW1lLnZhbCgpID09PSAnX2RlZmF1bHQnLFxuICAgICk7XG4gICAgaWYgKGV4cG9ydE5hbWUgIT0gbnVsbCkge1xuICAgICAgbGV0IG5ld0JpbmRpbmcgPSBnZW5zeW0oJ19kZWZhdWx0Jyk7XG4gICAgICBsZXQgdG9Gb3J3YXJkID0gZXhwb3J0TmFtZS5leHBvcnRlZE5hbWU7XG5cbiAgICAgIGlmIChcbiAgICAgICAgIWlzRW50cnlwb2ludCB8fFxuICAgICAgICBpc0JvdW5kVG9Db21waWxldGltZSh0b0ZvcndhcmQsIGNvbnRleHQuc3RvcmUpIHx8XG4gICAgICAgIGltcFRlcm0uZm9yU3ludGF4XG4gICAgICApIHtcbiAgICAgICAgY29udGV4dC5iaW5kaW5ncy5hZGRGb3J3YXJkKG5hbWUsIHRvRm9yd2FyZCwgbmV3QmluZGluZywgcGhhc2VUb0JpbmQpO1xuICAgICAgfVxuICAgICAgbmFtZXMucHVzaChuYW1lKTtcbiAgICB9XG4gIH1cbiAgaWYgKGltcFRlcm0ubmFtZWRJbXBvcnRzKSB7XG4gICAgaW1wVGVybS5uYW1lZEltcG9ydHMuZm9yRWFjaChzcGVjaWZpZXIgPT4ge1xuICAgICAgbGV0IG5hbWUgPSBzcGVjaWZpZXIuYmluZGluZy5uYW1lO1xuICAgICAgbGV0IGV4cG9ydE5hbWUgPSBleE1vZHVsZS5leHBvcnRlZE5hbWVzLmZpbmQoZXhOYW1lID0+IHtcbiAgICAgICAgaWYgKGV4TmFtZS5leHBvcnRlZE5hbWUgIT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBleE5hbWUuZXhwb3J0ZWROYW1lLnZhbCgpID09PSBuYW1lLnZhbCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleE5hbWUubmFtZSAmJiBleE5hbWUubmFtZS52YWwoKSA9PT0gbmFtZS52YWwoKTtcbiAgICAgIH0pO1xuICAgICAgaWYgKGV4cG9ydE5hbWUgIT0gbnVsbCkge1xuICAgICAgICBsZXQgbmV3QmluZGluZyA9IGdlbnN5bShuYW1lLnZhbCgpKTtcbiAgICAgICAgbGV0IHRvRm9yd2FyZCA9IGV4cG9ydE5hbWUubmFtZVxuICAgICAgICAgID8gZXhwb3J0TmFtZS5uYW1lXG4gICAgICAgICAgOiBleHBvcnROYW1lLmV4cG9ydGVkTmFtZTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICFpc0VudHJ5cG9pbnQgfHxcbiAgICAgICAgICBpc0JvdW5kVG9Db21waWxldGltZSh0b0ZvcndhcmQsIGNvbnRleHQuc3RvcmUpIHx8XG4gICAgICAgICAgaW1wVGVybS5mb3JTeW50YXhcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29udGV4dC5iaW5kaW5ncy5hZGRGb3J3YXJkKG5hbWUsIHRvRm9yd2FyZCwgbmV3QmluZGluZywgcGhhc2VUb0JpbmQpO1xuICAgICAgICB9XG4gICAgICAgIG5hbWVzLnB1c2gobmFtZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgaWYgKGltcFRlcm0ubmFtZXNwYWNlQmluZGluZykge1xuICAgIGxldCBuYW1lID0gaW1wVGVybS5uYW1lc3BhY2VCaW5kaW5nLm5hbWU7XG4gICAgbGV0IG5ld0JpbmRpbmcgPSBnZW5zeW0obmFtZS52YWwoKSk7XG4gICAgY29udGV4dC5zdG9yZS5zZXQoXG4gICAgICBuZXdCaW5kaW5nLnRvU3RyaW5nKCksXG4gICAgICBuZXcgTW9kdWxlTmFtZXNwYWNlVHJhbnNmb3JtKG5hbWUsIGV4TW9kdWxlKSxcbiAgICApO1xuICAgIGNvbnRleHQuYmluZGluZ3MuYWRkKG5hbWUsIHtcbiAgICAgIGJpbmRpbmc6IG5ld0JpbmRpbmcsXG4gICAgICBwaGFzZTogcGhhc2VUb0JpbmQsXG4gICAgICBza2lwRHVwOiBmYWxzZSxcbiAgICB9KTtcblxuICAgIG5hbWVzLnB1c2gobmFtZSk7XG4gIH1cbiAgcmV0dXJuIExpc3QobmFtZXMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XG4gIGNvbnRleHQ6IENvbnRleHQ7XG5cbiAgY29uc3RydWN0b3IoY29udGV4dDogQ29udGV4dCkge1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gIH1cblxuICB2aXNpdChtb2Q6IFN3ZWV0TW9kdWxlLCBwaGFzZTogYW55LCBzdG9yZTogYW55LCBjd2Q6IHN0cmluZykge1xuICAgIG1vZC5pbXBvcnRzLmZvckVhY2goaW1wID0+IHtcbiAgICAgIGlmIChpbXAuZm9yU3ludGF4KSB7XG4gICAgICAgIGxldCBtb2QgPSB0aGlzLmNvbnRleHQubG9hZGVyLmdldChcbiAgICAgICAgICBpbXAubW9kdWxlU3BlY2lmaWVyLnZhbCgpLFxuICAgICAgICAgIHBoYXNlICsgMSxcbiAgICAgICAgICBjd2QsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMudmlzaXQobW9kLCBwaGFzZSArIDEsIHN0b3JlLCBtb2QucGF0aCk7XG4gICAgICAgIHRoaXMuaW52b2tlKG1vZCwgcGhhc2UgKyAxLCBzdG9yZSwgbW9kLnBhdGgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IG1vZCA9IHRoaXMuY29udGV4dC5sb2FkZXIuZ2V0KFxuICAgICAgICAgIGltcC5tb2R1bGVTcGVjaWZpZXIudmFsKCksXG4gICAgICAgICAgcGhhc2UsXG4gICAgICAgICAgY3dkLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLnZpc2l0KG1vZCwgcGhhc2UsIHN0b3JlLCBtb2QucGF0aCk7XG4gICAgICB9XG4gICAgICBiaW5kSW1wb3J0cyhpbXAsIG1vZCwgcGhhc2UsIHRoaXMuY29udGV4dCwgZmFsc2UpO1xuICAgIH0pO1xuICAgIGZvciAobGV0IHRlcm0gb2YgbW9kLmNvbXBpbGV0aW1lSXRlbXMoKSkge1xuICAgICAgaWYgKFMuaXNTeW50YXhEZWNsYXJhdGlvblN0YXRlbWVudCh0ZXJtKSkge1xuICAgICAgICB0aGlzLnJlZ2lzdGVyU3ludGF4RGVjbGFyYXRpb24oKHRlcm06IGFueSkuZGVjbGFyYXRpb24sIHBoYXNlLCBzdG9yZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdG9yZTtcbiAgfVxuXG4gIGludm9rZShtb2Q6IGFueSwgcGhhc2U6IGFueSwgc3RvcmU6IGFueSwgY3dkOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5jb250ZXh0Lmludm9rZWRSZWdpc3RyeS5jb250YWluc0F0KG1vZC5wYXRoLCBwaGFzZSkpIHtcbiAgICAgIHJldHVybiBzdG9yZTtcbiAgICB9XG4gICAgbW9kLmltcG9ydHMuZm9yRWFjaChpbXAgPT4ge1xuICAgICAgaWYgKCFpbXAuZm9yU3ludGF4KSB7XG4gICAgICAgIGxldCBtb2QgPSB0aGlzLmNvbnRleHQubG9hZGVyLmdldChcbiAgICAgICAgICBpbXAubW9kdWxlU3BlY2lmaWVyLnZhbCgpLFxuICAgICAgICAgIHBoYXNlLFxuICAgICAgICAgIGN3ZCxcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5pbnZva2UobW9kLCBwaGFzZSwgc3RvcmUsIG1vZC5wYXRoKTtcbiAgICAgICAgYmluZEltcG9ydHMoaW1wLCBtb2QsIHBoYXNlLCB0aGlzLmNvbnRleHQsIGZhbHNlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBsZXQgaXRlbXMgPSBtb2QucnVudGltZUl0ZW1zKCk7XG4gICAgZm9yIChsZXQgdGVybSBvZiBpdGVtcykge1xuICAgICAgaWYgKFMuaXNWYXJpYWJsZURlY2xhcmF0aW9uU3RhdGVtZW50KHRlcm0pKSB7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJWYXJpYWJsZURlY2xhcmF0aW9uKHRlcm0uZGVjbGFyYXRpb24sIHBoYXNlLCBzdG9yZSk7XG4gICAgICB9IGVsc2UgaWYgKFMuaXNGdW5jdGlvbkRlY2xhcmF0aW9uKHRlcm0pKSB7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJGdW5jdGlvbk9yQ2xhc3ModGVybSwgcGhhc2UsIHN0b3JlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IHBhcnNlZCA9IG5ldyBULk1vZHVsZSh7XG4gICAgICBkaXJlY3RpdmVzOiBMaXN0KCksXG4gICAgICBpdGVtcyxcbiAgICAgIC8vICRGbG93Rml4TWU6IGZsb3cgZG9lc24ndCBrbm93IGFib3V0IHJlZHVjZSB5ZXRcbiAgICB9KS5yZWR1Y2UobmV3IFN3ZWV0VG9TaGlmdFJlZHVjZXIocGhhc2UpKTtcblxuICAgIGxldCBnZW4gPSBjb2RlZ2VuKHBhcnNlZCwgbmV3IEZvcm1hdHRlZENvZGVHZW4oKSk7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMuY29udGV4dC50cmFuc2Zvcm0oZ2VuKTtcblxuICAgIHRoaXMuY29udGV4dC5sb2FkZXIuZXZhbChyZXN1bHQuY29kZSwgc3RvcmUpO1xuICAgIHRoaXMuY29udGV4dC5pbnZva2VkUmVnaXN0cnkuYWRkKG1vZC5wYXRoLCBwaGFzZSk7XG4gICAgcmV0dXJuIHN0b3JlO1xuICB9XG5cbiAgcmVnaXN0ZXJTeW50YXhEZWNsYXJhdGlvbih0ZXJtOiBhbnksIHBoYXNlOiBhbnksIHN0b3JlOiBhbnkpIHtcbiAgICB0ZXJtLmRlY2xhcmF0b3JzLmZvckVhY2goZGVjbCA9PiB7XG4gICAgICBsZXQgdmFsID0gZXZhbENvbXBpbGV0aW1lVmFsdWUoXG4gICAgICAgIGRlY2wuaW5pdCxcbiAgICAgICAgXy5tZXJnZSh0aGlzLmNvbnRleHQsIHtcbiAgICAgICAgICBwaGFzZTogcGhhc2UgKyAxLFxuICAgICAgICAgIHN0b3JlLFxuICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAgIGNvbGxlY3RCaW5kaW5ncyhkZWNsLmJpbmRpbmcpLmZvckVhY2goc3R4ID0+IHtcbiAgICAgICAgaWYgKHBoYXNlICE9PSAwKSB7XG4gICAgICAgICAgLy8gcGhhc2UgMCBiaW5kaW5ncyBleHRlbmQgdGhlIGJpbmRpbmcgbWFwIGR1cmluZyBjb21waWxhdGlvblxuICAgICAgICAgIGxldCBuZXdCaW5kaW5nID0gZ2Vuc3ltKHN0eC52YWwoKSk7XG4gICAgICAgICAgdGhpcy5jb250ZXh0LmJpbmRpbmdzLmFkZChzdHgsIHtcbiAgICAgICAgICAgIGJpbmRpbmc6IG5ld0JpbmRpbmcsXG4gICAgICAgICAgICBwaGFzZTogcGhhc2UsXG4gICAgICAgICAgICBza2lwRHVwOiBmYWxzZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgcmVzb2x2ZWROYW1lID0gc3R4LnJlc29sdmUocGhhc2UpO1xuICAgICAgICBsZXQgY29tcGlsZXRpbWVUeXBlID0gdGVybS5raW5kID09PSAnb3BlcmF0b3InID8gJ29wZXJhdG9yJyA6ICdzeW50YXgnO1xuICAgICAgICBzdG9yZS5zZXQoXG4gICAgICAgICAgcmVzb2x2ZWROYW1lLFxuICAgICAgICAgIG5ldyBDb21waWxldGltZVRyYW5zZm9ybSh7XG4gICAgICAgICAgICB0eXBlOiBjb21waWxldGltZVR5cGUsXG4gICAgICAgICAgICBwcmVjOiBkZWNsLnByZWMgPT0gbnVsbCA/IHZvaWQgMCA6IGRlY2wucHJlYy52YWwoKSxcbiAgICAgICAgICAgIGFzc29jOiBkZWNsLmFzc29jID09IG51bGwgPyB2b2lkIDAgOiBkZWNsLmFzc29jLnZhbCgpLFxuICAgICAgICAgICAgZjogdmFsLFxuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICByZWdpc3RlclZhcmlhYmxlRGVjbGFyYXRpb24odGVybTogYW55LCBwaGFzZTogYW55LCBzdG9yZTogYW55KSB7XG4gICAgdGVybS5kZWNsYXJhdG9ycy5mb3JFYWNoKGRlY2wgPT4ge1xuICAgICAgY29sbGVjdEJpbmRpbmdzKGRlY2wuYmluZGluZykuZm9yRWFjaChzdHggPT4ge1xuICAgICAgICBpZiAocGhhc2UgIT09IDApIHtcbiAgICAgICAgICAvLyBwaGFzZSAwIGJpbmRpbmdzIGV4dGVuZCB0aGUgYmluZGluZyBtYXAgZHVyaW5nIGNvbXBpbGF0aW9uXG4gICAgICAgICAgbGV0IG5ld0JpbmRpbmcgPSBnZW5zeW0oc3R4LnZhbCgpKTtcbiAgICAgICAgICB0aGlzLmNvbnRleHQuYmluZGluZ3MuYWRkKHN0eCwge1xuICAgICAgICAgICAgYmluZGluZzogbmV3QmluZGluZyxcbiAgICAgICAgICAgIHBoYXNlOiBwaGFzZSxcbiAgICAgICAgICAgIHNraXBEdXA6IHRlcm0ua2luZCA9PT0gJ3ZhcicsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcmVnaXN0ZXJGdW5jdGlvbk9yQ2xhc3ModGVybTogYW55LCBwaGFzZTogYW55LCBzdG9yZTogYW55KSB7XG4gICAgY29sbGVjdEJpbmRpbmdzKHRlcm0ubmFtZSkuZm9yRWFjaChzdHggPT4ge1xuICAgICAgaWYgKHBoYXNlICE9PSAwKSB7XG4gICAgICAgIGxldCBuZXdCaW5kaW5nID0gZ2Vuc3ltKHN0eC52YWwoKSk7XG4gICAgICAgIHRoaXMuY29udGV4dC5iaW5kaW5ncy5hZGQoc3R4LCB7XG4gICAgICAgICAgYmluZGluZzogbmV3QmluZGluZyxcbiAgICAgICAgICBwaGFzZTogcGhhc2UsXG4gICAgICAgICAgc2tpcER1cDogZmFsc2UsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG4iXX0=