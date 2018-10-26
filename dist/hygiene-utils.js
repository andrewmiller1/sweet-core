'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CollectBindingSyntax = undefined;
exports.collectBindings = collectBindings;

var _immutable = require('immutable');

var _astDispatcher = require('./ast-dispatcher');

var _astDispatcher2 = _interopRequireDefault(_astDispatcher);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class CollectBindingSyntax extends _astDispatcher2.default {
  constructor() {
    super('collect', true);
    this.names = (0, _immutable.List)();
  }

  // registerSyntax(stx) {
  //   let newBinding = gensym(stx.val());
  //   this.context.bindings.add(stx, {
  //     binding: newBinding,
  //     phase: this.context.phase,
  //     // skip dup because js allows variable redeclarations
  //     // (technically only for `var` but we can let later stages of the pipeline
  //     // handle incorrect redeclarations of `const` and `let`)
  //     skipDup: true
  //   });
  //   return stx;
  // }

  collect(term) {
    return this.dispatch(term);
  }

  collectBindingIdentifier(term) {
    return this.names.concat(term.name);
  }

  collectBindingPropertyIdentifier(term) {
    return this.collect(term.binding);
  }

  collectBindingPropertyProperty(term) {
    return this.collect(term.binding);
  }

  collectArrayBinding(term) {
    let rest = null;
    if (term.rest != null) {
      rest = this.collect(term.rest);
    }
    return this.names.concat(rest).concat(term.elements.filter(el => el != null).flatMap(el => this.collect(el)));
  }

  collectObjectBinding() {
    // return term.properties.flatMap(prop => this.collect(prop));
    return (0, _immutable.List)();
  }

  // registerVariableDeclaration(term) {
  //   let declarators = term.declarators.map(decl => {
  //     return decl.extend({
  //       binding: this.register(decl.binding)
  //     });
  //   });
  //   return term.extend({ declarators });
  // }
  //
  // registerFunctionDeclaration(term) {
  //   return term.extend({
  //     name: this.register(term.name)
  //   });
  // }
  //
  // registerExport(term) {
  //   return term.extend({
  //     declaration: this.register(term.declaration)
  //   });
  // }
}

exports.CollectBindingSyntax = CollectBindingSyntax;
function collectBindings(term) {
  return new CollectBindingSyntax().collect(term);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9oeWdpZW5lLXV0aWxzLmpzIl0sIm5hbWVzIjpbImNvbGxlY3RCaW5kaW5ncyIsIkNvbGxlY3RCaW5kaW5nU3ludGF4IiwiY29uc3RydWN0b3IiLCJuYW1lcyIsImNvbGxlY3QiLCJ0ZXJtIiwiZGlzcGF0Y2giLCJjb2xsZWN0QmluZGluZ0lkZW50aWZpZXIiLCJjb25jYXQiLCJuYW1lIiwiY29sbGVjdEJpbmRpbmdQcm9wZXJ0eUlkZW50aWZpZXIiLCJiaW5kaW5nIiwiY29sbGVjdEJpbmRpbmdQcm9wZXJ0eVByb3BlcnR5IiwiY29sbGVjdEFycmF5QmluZGluZyIsInJlc3QiLCJlbGVtZW50cyIsImZpbHRlciIsImVsIiwiZmxhdE1hcCIsImNvbGxlY3RPYmplY3RCaW5kaW5nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7UUE4RWdCQSxlLEdBQUFBLGU7O0FBOUVoQjs7QUFFQTs7Ozs7O0FBRU8sTUFBTUMsb0JBQU4saUNBQWlEO0FBQ3REQyxnQkFBYztBQUNaLFVBQU0sU0FBTixFQUFpQixJQUFqQjtBQUNBLFNBQUtDLEtBQUwsR0FBYSxzQkFBYjtBQUNEOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQUMsVUFBUUMsSUFBUixFQUFjO0FBQ1osV0FBTyxLQUFLQyxRQUFMLENBQWNELElBQWQsQ0FBUDtBQUNEOztBQUVERSwyQkFBeUJGLElBQXpCLEVBQStCO0FBQzdCLFdBQU8sS0FBS0YsS0FBTCxDQUFXSyxNQUFYLENBQWtCSCxLQUFLSSxJQUF2QixDQUFQO0FBQ0Q7O0FBRURDLG1DQUFpQ0wsSUFBakMsRUFBdUM7QUFDckMsV0FBTyxLQUFLRCxPQUFMLENBQWFDLEtBQUtNLE9BQWxCLENBQVA7QUFDRDs7QUFFREMsaUNBQStCUCxJQUEvQixFQUFxQztBQUNuQyxXQUFPLEtBQUtELE9BQUwsQ0FBYUMsS0FBS00sT0FBbEIsQ0FBUDtBQUNEOztBQUVERSxzQkFBb0JSLElBQXBCLEVBQTBCO0FBQ3hCLFFBQUlTLE9BQU8sSUFBWDtBQUNBLFFBQUlULEtBQUtTLElBQUwsSUFBYSxJQUFqQixFQUF1QjtBQUNyQkEsYUFBTyxLQUFLVixPQUFMLENBQWFDLEtBQUtTLElBQWxCLENBQVA7QUFDRDtBQUNELFdBQU8sS0FBS1gsS0FBTCxDQUNKSyxNQURJLENBQ0dNLElBREgsRUFFSk4sTUFGSSxDQUdISCxLQUFLVSxRQUFMLENBQWNDLE1BQWQsQ0FBcUJDLE1BQU1BLE1BQU0sSUFBakMsRUFBdUNDLE9BQXZDLENBQStDRCxNQUFNLEtBQUtiLE9BQUwsQ0FBYWEsRUFBYixDQUFyRCxDQUhHLENBQVA7QUFLRDs7QUFFREUseUJBQXVCO0FBQ3JCO0FBQ0EsV0FBTyxzQkFBUDtBQUNEOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUF2RXNEOztRQUEzQ2xCLG9CLEdBQUFBLG9CO0FBMEVOLFNBQVNELGVBQVQsQ0FBeUJLLElBQXpCLEVBQStCO0FBQ3BDLFNBQU8sSUFBSUosb0JBQUosR0FBMkJHLE9BQTNCLENBQW1DQyxJQUFuQyxDQUFQO0FBQ0QiLCJmaWxlIjoiaHlnaWVuZS11dGlscy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IExpc3QgfSBmcm9tICdpbW11dGFibGUnO1xuXG5pbXBvcnQgQVNURGlzcGF0Y2hlciBmcm9tICcuL2FzdC1kaXNwYXRjaGVyJztcblxuZXhwb3J0IGNsYXNzIENvbGxlY3RCaW5kaW5nU3ludGF4IGV4dGVuZHMgQVNURGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCdjb2xsZWN0JywgdHJ1ZSk7XG4gICAgdGhpcy5uYW1lcyA9IExpc3QoKTtcbiAgfVxuXG4gIC8vIHJlZ2lzdGVyU3ludGF4KHN0eCkge1xuICAvLyAgIGxldCBuZXdCaW5kaW5nID0gZ2Vuc3ltKHN0eC52YWwoKSk7XG4gIC8vICAgdGhpcy5jb250ZXh0LmJpbmRpbmdzLmFkZChzdHgsIHtcbiAgLy8gICAgIGJpbmRpbmc6IG5ld0JpbmRpbmcsXG4gIC8vICAgICBwaGFzZTogdGhpcy5jb250ZXh0LnBoYXNlLFxuICAvLyAgICAgLy8gc2tpcCBkdXAgYmVjYXVzZSBqcyBhbGxvd3MgdmFyaWFibGUgcmVkZWNsYXJhdGlvbnNcbiAgLy8gICAgIC8vICh0ZWNobmljYWxseSBvbmx5IGZvciBgdmFyYCBidXQgd2UgY2FuIGxldCBsYXRlciBzdGFnZXMgb2YgdGhlIHBpcGVsaW5lXG4gIC8vICAgICAvLyBoYW5kbGUgaW5jb3JyZWN0IHJlZGVjbGFyYXRpb25zIG9mIGBjb25zdGAgYW5kIGBsZXRgKVxuICAvLyAgICAgc2tpcER1cDogdHJ1ZVxuICAvLyAgIH0pO1xuICAvLyAgIHJldHVybiBzdHg7XG4gIC8vIH1cblxuICBjb2xsZWN0KHRlcm0pIHtcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaCh0ZXJtKTtcbiAgfVxuXG4gIGNvbGxlY3RCaW5kaW5nSWRlbnRpZmllcih0ZXJtKSB7XG4gICAgcmV0dXJuIHRoaXMubmFtZXMuY29uY2F0KHRlcm0ubmFtZSk7XG4gIH1cblxuICBjb2xsZWN0QmluZGluZ1Byb3BlcnR5SWRlbnRpZmllcih0ZXJtKSB7XG4gICAgcmV0dXJuIHRoaXMuY29sbGVjdCh0ZXJtLmJpbmRpbmcpO1xuICB9XG5cbiAgY29sbGVjdEJpbmRpbmdQcm9wZXJ0eVByb3BlcnR5KHRlcm0pIHtcbiAgICByZXR1cm4gdGhpcy5jb2xsZWN0KHRlcm0uYmluZGluZyk7XG4gIH1cblxuICBjb2xsZWN0QXJyYXlCaW5kaW5nKHRlcm0pIHtcbiAgICBsZXQgcmVzdCA9IG51bGw7XG4gICAgaWYgKHRlcm0ucmVzdCAhPSBudWxsKSB7XG4gICAgICByZXN0ID0gdGhpcy5jb2xsZWN0KHRlcm0ucmVzdCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm5hbWVzXG4gICAgICAuY29uY2F0KHJlc3QpXG4gICAgICAuY29uY2F0KFxuICAgICAgICB0ZXJtLmVsZW1lbnRzLmZpbHRlcihlbCA9PiBlbCAhPSBudWxsKS5mbGF0TWFwKGVsID0+IHRoaXMuY29sbGVjdChlbCkpLFxuICAgICAgKTtcbiAgfVxuXG4gIGNvbGxlY3RPYmplY3RCaW5kaW5nKCkge1xuICAgIC8vIHJldHVybiB0ZXJtLnByb3BlcnRpZXMuZmxhdE1hcChwcm9wID0+IHRoaXMuY29sbGVjdChwcm9wKSk7XG4gICAgcmV0dXJuIExpc3QoKTtcbiAgfVxuXG4gIC8vIHJlZ2lzdGVyVmFyaWFibGVEZWNsYXJhdGlvbih0ZXJtKSB7XG4gIC8vICAgbGV0IGRlY2xhcmF0b3JzID0gdGVybS5kZWNsYXJhdG9ycy5tYXAoZGVjbCA9PiB7XG4gIC8vICAgICByZXR1cm4gZGVjbC5leHRlbmQoe1xuICAvLyAgICAgICBiaW5kaW5nOiB0aGlzLnJlZ2lzdGVyKGRlY2wuYmluZGluZylcbiAgLy8gICAgIH0pO1xuICAvLyAgIH0pO1xuICAvLyAgIHJldHVybiB0ZXJtLmV4dGVuZCh7IGRlY2xhcmF0b3JzIH0pO1xuICAvLyB9XG4gIC8vXG4gIC8vIHJlZ2lzdGVyRnVuY3Rpb25EZWNsYXJhdGlvbih0ZXJtKSB7XG4gIC8vICAgcmV0dXJuIHRlcm0uZXh0ZW5kKHtcbiAgLy8gICAgIG5hbWU6IHRoaXMucmVnaXN0ZXIodGVybS5uYW1lKVxuICAvLyAgIH0pO1xuICAvLyB9XG4gIC8vXG4gIC8vIHJlZ2lzdGVyRXhwb3J0KHRlcm0pIHtcbiAgLy8gICByZXR1cm4gdGVybS5leHRlbmQoe1xuICAvLyAgICAgZGVjbGFyYXRpb246IHRoaXMucmVnaXN0ZXIodGVybS5kZWNsYXJhdGlvbilcbiAgLy8gICB9KTtcbiAgLy8gfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdEJpbmRpbmdzKHRlcm0pIHtcbiAgcmV0dXJuIG5ldyBDb2xsZWN0QmluZGluZ1N5bnRheCgpLmNvbGxlY3QodGVybSk7XG59XG4iXX0=