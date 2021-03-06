'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.gensym = gensym;
let internedMap = new Map();

let counter = 0;

function gensym(name) {
  let prefix = name == null ? 's_' : name + '_';
  let sym = new Symbol(prefix + counter);
  counter++;
  return sym;
}

class Symbol {

  constructor(name) {
    this.name = name;
  }
  toString() {
    return this.name;
  }
}

function makeSymbol(name) {
  let s = internedMap.get(name);
  if (s) {
    return s;
  } else {
    let sym = new Symbol(name);
    internedMap.set(name, sym);
    return sym;
  }
}

exports.Symbol = makeSymbol;
exports.SymbolClass = Symbol;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zeW1ib2wuanMiXSwibmFtZXMiOlsiZ2Vuc3ltIiwiaW50ZXJuZWRNYXAiLCJNYXAiLCJjb3VudGVyIiwibmFtZSIsInByZWZpeCIsInN5bSIsIlN5bWJvbCIsImNvbnN0cnVjdG9yIiwidG9TdHJpbmciLCJtYWtlU3ltYm9sIiwicyIsImdldCIsInNldCIsIlN5bWJvbENsYXNzIl0sIm1hcHBpbmdzIjoiOzs7OztRQUtnQkEsTSxHQUFBQSxNO0FBSmhCLElBQUlDLGNBQW1DLElBQUlDLEdBQUosRUFBdkM7O0FBRUEsSUFBSUMsVUFBVSxDQUFkOztBQUVPLFNBQVNILE1BQVQsQ0FBZ0JJLElBQWhCLEVBQThCO0FBQ25DLE1BQUlDLFNBQVNELFFBQVEsSUFBUixHQUFlLElBQWYsR0FBc0JBLE9BQU8sR0FBMUM7QUFDQSxNQUFJRSxNQUFNLElBQUlDLE1BQUosQ0FBV0YsU0FBU0YsT0FBcEIsQ0FBVjtBQUNBQTtBQUNBLFNBQU9HLEdBQVA7QUFDRDs7QUFFRCxNQUFNQyxNQUFOLENBQWE7O0FBR1hDLGNBQVlKLElBQVosRUFBMEI7QUFDeEIsU0FBS0EsSUFBTCxHQUFZQSxJQUFaO0FBQ0Q7QUFDREssYUFBVztBQUNULFdBQU8sS0FBS0wsSUFBWjtBQUNEO0FBUlU7O0FBV2IsU0FBU00sVUFBVCxDQUFvQk4sSUFBcEIsRUFBMEM7QUFDeEMsTUFBSU8sSUFBSVYsWUFBWVcsR0FBWixDQUFnQlIsSUFBaEIsQ0FBUjtBQUNBLE1BQUlPLENBQUosRUFBTztBQUNMLFdBQU9BLENBQVA7QUFDRCxHQUZELE1BRU87QUFDTCxRQUFJTCxNQUFNLElBQUlDLE1BQUosQ0FBV0gsSUFBWCxDQUFWO0FBQ0FILGdCQUFZWSxHQUFaLENBQWdCVCxJQUFoQixFQUFzQkUsR0FBdEI7QUFDQSxXQUFPQSxHQUFQO0FBQ0Q7QUFDRjs7UUFFc0JDLE0sR0FBZEcsVTtRQUFnQ0ksVyxHQUFWUCxNIiwiZmlsZSI6InN5bWJvbC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEBmbG93XG5sZXQgaW50ZXJuZWRNYXA6IE1hcDxzdHJpbmcsIFN5bWJvbD4gPSBuZXcgTWFwKCk7XG5cbmxldCBjb3VudGVyID0gMDtcblxuZXhwb3J0IGZ1bmN0aW9uIGdlbnN5bShuYW1lOiBzdHJpbmcpIHtcbiAgbGV0IHByZWZpeCA9IG5hbWUgPT0gbnVsbCA/ICdzXycgOiBuYW1lICsgJ18nO1xuICBsZXQgc3ltID0gbmV3IFN5bWJvbChwcmVmaXggKyBjb3VudGVyKTtcbiAgY291bnRlcisrO1xuICByZXR1cm4gc3ltO1xufVxuXG5jbGFzcyBTeW1ib2wge1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgfVxuICB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gdGhpcy5uYW1lO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1ha2VTeW1ib2wobmFtZTogc3RyaW5nKTogU3ltYm9sIHtcbiAgbGV0IHMgPSBpbnRlcm5lZE1hcC5nZXQobmFtZSk7XG4gIGlmIChzKSB7XG4gICAgcmV0dXJuIHM7XG4gIH0gZWxzZSB7XG4gICAgbGV0IHN5bSA9IG5ldyBTeW1ib2wobmFtZSk7XG4gICAgaW50ZXJuZWRNYXAuc2V0KG5hbWUsIHN5bSk7XG4gICAgcmV0dXJuIHN5bTtcbiAgfVxufVxuXG5leHBvcnQgeyBtYWtlU3ltYm9sIGFzIFN5bWJvbCwgU3ltYm9sIGFzIFN5bWJvbENsYXNzIH07XG4iXX0=