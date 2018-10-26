'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _immutable = require('immutable');

var _errors = require('./errors');

var _ramdaFantasy = require('ramda-fantasy');

var _syntax = require('./syntax');

var _syntax2 = _interopRequireDefault(_syntax);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class BindingMap {

  constructor() {
    this._map = new Map();
  }

  // given a syntax object and a binding,
  // add the binding to the map associating the binding with the syntax object's
  // scope set
  add(stx, {
    binding,
    phase,
    skipDup = false
  }) {
    let stxName = stx.val();
    let allScopeset = stx.scopesets.all;
    let scopeset = stx.scopesets.phase.has(phase) ? stx.scopesets.phase.get(phase) : (0, _immutable.List)();
    scopeset = allScopeset.concat(scopeset);
    (0, _errors.assert)(phase != null, 'must provide a phase for binding add');

    let scopesetBindingList = this._map.get(stxName);
    if (scopesetBindingList) {
      if (skipDup && scopesetBindingList.some(s => s.scopes.equals(scopeset))) {
        return;
      }
      this._map.set(stxName, scopesetBindingList.push({
        scopes: scopeset,
        binding: binding,
        alias: _ramdaFantasy.Maybe.Nothing()
      }));
    } else {
      this._map.set(stxName, _immutable.List.of({
        scopes: scopeset,
        binding: binding,
        alias: _ramdaFantasy.Maybe.Nothing()
      }));
    }
  }

  addForward(stx, forwardStx, binding, phase) {
    let stxName = stx.token.value;
    let allScopeset = stx.scopesets.all;
    let scopeset = stx.scopesets.phase.has(phase) ? stx.scopesets.phase.get(phase) : (0, _immutable.List)();
    scopeset = allScopeset.concat(scopeset);
    (0, _errors.assert)(phase != null, 'must provide a phase for binding add');

    let scopesetBindingList = this._map.get(stxName);
    if (scopesetBindingList) {
      this._map.set(stxName, scopesetBindingList.push({
        scopes: scopeset,
        binding: binding,
        alias: _ramdaFantasy.Maybe.of(forwardStx)
      }));
    } else {
      this._map.set(stxName, _immutable.List.of({
        scopes: scopeset,
        binding: binding,
        alias: _ramdaFantasy.Maybe.of(forwardStx)
      }));
    }
  }

  get(stx) {
    return this._map.get(stx.token.value);
  }
}
exports.default = BindingMap;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9iaW5kaW5nLW1hcC5qcyJdLCJuYW1lcyI6WyJCaW5kaW5nTWFwIiwiY29uc3RydWN0b3IiLCJfbWFwIiwiTWFwIiwiYWRkIiwic3R4IiwiYmluZGluZyIsInBoYXNlIiwic2tpcER1cCIsInN0eE5hbWUiLCJ2YWwiLCJhbGxTY29wZXNldCIsInNjb3Blc2V0cyIsImFsbCIsInNjb3Blc2V0IiwiaGFzIiwiZ2V0IiwiY29uY2F0Iiwic2NvcGVzZXRCaW5kaW5nTGlzdCIsInNvbWUiLCJzIiwic2NvcGVzIiwiZXF1YWxzIiwic2V0IiwicHVzaCIsImFsaWFzIiwiTm90aGluZyIsIm9mIiwiYWRkRm9yd2FyZCIsImZvcndhcmRTdHgiLCJ0b2tlbiIsInZhbHVlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFDQTs7QUFDQTs7QUFDQTs7QUFFQTs7Ozs7O0FBVWUsTUFBTUEsVUFBTixDQUFpQjs7QUFHOUJDLGdCQUFjO0FBQ1osU0FBS0MsSUFBTCxHQUFZLElBQUlDLEdBQUosRUFBWjtBQUNEOztBQUVEO0FBQ0E7QUFDQTtBQUNBQyxNQUNFQyxHQURGLEVBRUU7QUFDRUMsV0FERjtBQUVFQyxTQUZGO0FBR0VDLGNBQVU7QUFIWixHQUZGLEVBT0U7QUFDQSxRQUFJQyxVQUFVSixJQUFJSyxHQUFKLEVBQWQ7QUFDQSxRQUFJQyxjQUFjTixJQUFJTyxTQUFKLENBQWNDLEdBQWhDO0FBQ0EsUUFBSUMsV0FBV1QsSUFBSU8sU0FBSixDQUFjTCxLQUFkLENBQW9CUSxHQUFwQixDQUF3QlIsS0FBeEIsSUFDWEYsSUFBSU8sU0FBSixDQUFjTCxLQUFkLENBQW9CUyxHQUFwQixDQUF3QlQsS0FBeEIsQ0FEVyxHQUVYLHNCQUZKO0FBR0FPLGVBQVdILFlBQVlNLE1BQVosQ0FBbUJILFFBQW5CLENBQVg7QUFDQSx3QkFBT1AsU0FBUyxJQUFoQixFQUFzQixzQ0FBdEI7O0FBRUEsUUFBSVcsc0JBQXNCLEtBQUtoQixJQUFMLENBQVVjLEdBQVYsQ0FBY1AsT0FBZCxDQUExQjtBQUNBLFFBQUlTLG1CQUFKLEVBQXlCO0FBQ3ZCLFVBQUlWLFdBQVdVLG9CQUFvQkMsSUFBcEIsQ0FBeUJDLEtBQUtBLEVBQUVDLE1BQUYsQ0FBU0MsTUFBVCxDQUFnQlIsUUFBaEIsQ0FBOUIsQ0FBZixFQUF5RTtBQUN2RTtBQUNEO0FBQ0QsV0FBS1osSUFBTCxDQUFVcUIsR0FBVixDQUNFZCxPQURGLEVBRUVTLG9CQUFvQk0sSUFBcEIsQ0FBeUI7QUFDdkJILGdCQUFRUCxRQURlO0FBRXZCUixpQkFBU0EsT0FGYztBQUd2Qm1CLGVBQU8sb0JBQU1DLE9BQU47QUFIZ0IsT0FBekIsQ0FGRjtBQVFELEtBWkQsTUFZTztBQUNMLFdBQUt4QixJQUFMLENBQVVxQixHQUFWLENBQ0VkLE9BREYsRUFFRSxnQkFBS2tCLEVBQUwsQ0FBUTtBQUNOTixnQkFBUVAsUUFERjtBQUVOUixpQkFBU0EsT0FGSDtBQUdObUIsZUFBTyxvQkFBTUMsT0FBTjtBQUhELE9BQVIsQ0FGRjtBQVFEO0FBQ0Y7O0FBRURFLGFBQ0V2QixHQURGLEVBRUV3QixVQUZGLEVBR0V2QixPQUhGLEVBSUVDLEtBSkYsRUFLRTtBQUNBLFFBQUlFLFVBQVVKLElBQUl5QixLQUFKLENBQVVDLEtBQXhCO0FBQ0EsUUFBSXBCLGNBQWNOLElBQUlPLFNBQUosQ0FBY0MsR0FBaEM7QUFDQSxRQUFJQyxXQUFXVCxJQUFJTyxTQUFKLENBQWNMLEtBQWQsQ0FBb0JRLEdBQXBCLENBQXdCUixLQUF4QixJQUNYRixJQUFJTyxTQUFKLENBQWNMLEtBQWQsQ0FBb0JTLEdBQXBCLENBQXdCVCxLQUF4QixDQURXLEdBRVgsc0JBRko7QUFHQU8sZUFBV0gsWUFBWU0sTUFBWixDQUFtQkgsUUFBbkIsQ0FBWDtBQUNBLHdCQUFPUCxTQUFTLElBQWhCLEVBQXNCLHNDQUF0Qjs7QUFFQSxRQUFJVyxzQkFBc0IsS0FBS2hCLElBQUwsQ0FBVWMsR0FBVixDQUFjUCxPQUFkLENBQTFCO0FBQ0EsUUFBSVMsbUJBQUosRUFBeUI7QUFDdkIsV0FBS2hCLElBQUwsQ0FBVXFCLEdBQVYsQ0FDRWQsT0FERixFQUVFUyxvQkFBb0JNLElBQXBCLENBQXlCO0FBQ3ZCSCxnQkFBUVAsUUFEZTtBQUV2QlIsaUJBQVNBLE9BRmM7QUFHdkJtQixlQUFPLG9CQUFNRSxFQUFOLENBQVNFLFVBQVQ7QUFIZ0IsT0FBekIsQ0FGRjtBQVFELEtBVEQsTUFTTztBQUNMLFdBQUszQixJQUFMLENBQVVxQixHQUFWLENBQ0VkLE9BREYsRUFFRSxnQkFBS2tCLEVBQUwsQ0FBUTtBQUNOTixnQkFBUVAsUUFERjtBQUVOUixpQkFBU0EsT0FGSDtBQUdObUIsZUFBTyxvQkFBTUUsRUFBTixDQUFTRSxVQUFUO0FBSEQsT0FBUixDQUZGO0FBUUQ7QUFDRjs7QUFFRGIsTUFBSVgsR0FBSixFQUFpQjtBQUNmLFdBQU8sS0FBS0gsSUFBTCxDQUFVYyxHQUFWLENBQWNYLElBQUl5QixLQUFKLENBQVVDLEtBQXhCLENBQVA7QUFDRDtBQXpGNkI7a0JBQVgvQixVIiwiZmlsZSI6ImJpbmRpbmctbWFwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQGZsb3dcbmltcG9ydCB7IExpc3QgfSBmcm9tICdpbW11dGFibGUnO1xuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSAnLi9lcnJvcnMnO1xuaW1wb3J0IHsgTWF5YmUgfSBmcm9tICdyYW1kYS1mYW50YXN5JztcbmltcG9ydCB0eXBlIHsgU3ltYm9sQ2xhc3MgfSBmcm9tICcuL3N5bWJvbCc7XG5pbXBvcnQgU3ludGF4IGZyb20gJy4vc3ludGF4JztcblxudHlwZSBTY29wZXNldCA9IGFueTtcblxudHlwZSBTY29wZXNldEJpbmRpbmcgPSB7XG4gIHNjb3BlczogU2NvcGVzZXQsXG4gIGJpbmRpbmc6IFN5bWJvbENsYXNzLFxuICBhbGlhczogTWF5YmU8U3ludGF4Pixcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEJpbmRpbmdNYXAge1xuICBfbWFwOiBNYXA8c3RyaW5nLCBMaXN0PFNjb3Blc2V0QmluZGluZz4+O1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuX21hcCA9IG5ldyBNYXAoKTtcbiAgfVxuXG4gIC8vIGdpdmVuIGEgc3ludGF4IG9iamVjdCBhbmQgYSBiaW5kaW5nLFxuICAvLyBhZGQgdGhlIGJpbmRpbmcgdG8gdGhlIG1hcCBhc3NvY2lhdGluZyB0aGUgYmluZGluZyB3aXRoIHRoZSBzeW50YXggb2JqZWN0J3NcbiAgLy8gc2NvcGUgc2V0XG4gIGFkZChcbiAgICBzdHg6IFN5bnRheCxcbiAgICB7XG4gICAgICBiaW5kaW5nLFxuICAgICAgcGhhc2UsXG4gICAgICBza2lwRHVwID0gZmFsc2UsXG4gICAgfTogeyBiaW5kaW5nOiBTeW1ib2xDbGFzcywgcGhhc2U6IG51bWJlciB8IHt9LCBza2lwRHVwOiBib29sZWFuIH0sXG4gICkge1xuICAgIGxldCBzdHhOYW1lID0gc3R4LnZhbCgpO1xuICAgIGxldCBhbGxTY29wZXNldCA9IHN0eC5zY29wZXNldHMuYWxsO1xuICAgIGxldCBzY29wZXNldCA9IHN0eC5zY29wZXNldHMucGhhc2UuaGFzKHBoYXNlKVxuICAgICAgPyBzdHguc2NvcGVzZXRzLnBoYXNlLmdldChwaGFzZSlcbiAgICAgIDogTGlzdCgpO1xuICAgIHNjb3Blc2V0ID0gYWxsU2NvcGVzZXQuY29uY2F0KHNjb3Blc2V0KTtcbiAgICBhc3NlcnQocGhhc2UgIT0gbnVsbCwgJ211c3QgcHJvdmlkZSBhIHBoYXNlIGZvciBiaW5kaW5nIGFkZCcpO1xuXG4gICAgbGV0IHNjb3Blc2V0QmluZGluZ0xpc3QgPSB0aGlzLl9tYXAuZ2V0KHN0eE5hbWUpO1xuICAgIGlmIChzY29wZXNldEJpbmRpbmdMaXN0KSB7XG4gICAgICBpZiAoc2tpcER1cCAmJiBzY29wZXNldEJpbmRpbmdMaXN0LnNvbWUocyA9PiBzLnNjb3Blcy5lcXVhbHMoc2NvcGVzZXQpKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLl9tYXAuc2V0KFxuICAgICAgICBzdHhOYW1lLFxuICAgICAgICBzY29wZXNldEJpbmRpbmdMaXN0LnB1c2goe1xuICAgICAgICAgIHNjb3Blczogc2NvcGVzZXQsXG4gICAgICAgICAgYmluZGluZzogYmluZGluZyxcbiAgICAgICAgICBhbGlhczogTWF5YmUuTm90aGluZygpLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX21hcC5zZXQoXG4gICAgICAgIHN0eE5hbWUsXG4gICAgICAgIExpc3Qub2Yoe1xuICAgICAgICAgIHNjb3Blczogc2NvcGVzZXQsXG4gICAgICAgICAgYmluZGluZzogYmluZGluZyxcbiAgICAgICAgICBhbGlhczogTWF5YmUuTm90aGluZygpLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgYWRkRm9yd2FyZChcbiAgICBzdHg6IFN5bnRheCxcbiAgICBmb3J3YXJkU3R4OiBTeW50YXgsXG4gICAgYmluZGluZzogU3ltYm9sQ2xhc3MsXG4gICAgcGhhc2U6IG51bWJlciB8IHt9LFxuICApIHtcbiAgICBsZXQgc3R4TmFtZSA9IHN0eC50b2tlbi52YWx1ZTtcbiAgICBsZXQgYWxsU2NvcGVzZXQgPSBzdHguc2NvcGVzZXRzLmFsbDtcbiAgICBsZXQgc2NvcGVzZXQgPSBzdHguc2NvcGVzZXRzLnBoYXNlLmhhcyhwaGFzZSlcbiAgICAgID8gc3R4LnNjb3Blc2V0cy5waGFzZS5nZXQocGhhc2UpXG4gICAgICA6IExpc3QoKTtcbiAgICBzY29wZXNldCA9IGFsbFNjb3Blc2V0LmNvbmNhdChzY29wZXNldCk7XG4gICAgYXNzZXJ0KHBoYXNlICE9IG51bGwsICdtdXN0IHByb3ZpZGUgYSBwaGFzZSBmb3IgYmluZGluZyBhZGQnKTtcblxuICAgIGxldCBzY29wZXNldEJpbmRpbmdMaXN0ID0gdGhpcy5fbWFwLmdldChzdHhOYW1lKTtcbiAgICBpZiAoc2NvcGVzZXRCaW5kaW5nTGlzdCkge1xuICAgICAgdGhpcy5fbWFwLnNldChcbiAgICAgICAgc3R4TmFtZSxcbiAgICAgICAgc2NvcGVzZXRCaW5kaW5nTGlzdC5wdXNoKHtcbiAgICAgICAgICBzY29wZXM6IHNjb3Blc2V0LFxuICAgICAgICAgIGJpbmRpbmc6IGJpbmRpbmcsXG4gICAgICAgICAgYWxpYXM6IE1heWJlLm9mKGZvcndhcmRTdHgpLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX21hcC5zZXQoXG4gICAgICAgIHN0eE5hbWUsXG4gICAgICAgIExpc3Qub2Yoe1xuICAgICAgICAgIHNjb3Blczogc2NvcGVzZXQsXG4gICAgICAgICAgYmluZGluZzogYmluZGluZyxcbiAgICAgICAgICBhbGlhczogTWF5YmUub2YoZm9yd2FyZFN0eCksXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBnZXQoc3R4OiBTeW50YXgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFwLmdldChzdHgudG9rZW4udmFsdWUpO1xuICB9XG59XG4iXX0=