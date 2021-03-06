'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = readStringLiteral;

var _utils = require('./utils');

var _readtable = require('readtable');

var _tokens = require('../tokens');

function readStringLiteral(stream) {
  let str = '',
      octal = null,
      idx = 0,
      quote = stream.readString(),
      char = stream.peek(),
      lineStart;

  while (!(0, _readtable.isEOS)(char)) {
    if (char === quote) {
      stream.readString(++idx);
      if (lineStart != null) this.locationInfo.column += idx - lineStart;
      return new _tokens.StringToken({ str, octal });
    } else if (char === '\\') {
      [str, idx, octal, lineStart] = _utils.readStringEscape.call(this, str, stream, idx, octal);
    } else if ((0, _utils.isLineTerminator)(char.charCodeAt(0))) {
      throw this.createILLEGAL(char);
    } else {
      ++idx;
      str += char;
    }
    char = stream.peek(idx);
  }
  throw this.createILLEGAL(char);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yZWFkZXIvcmVhZC1zdHJpbmcuanMiXSwibmFtZXMiOlsicmVhZFN0cmluZ0xpdGVyYWwiLCJzdHJlYW0iLCJzdHIiLCJvY3RhbCIsImlkeCIsInF1b3RlIiwicmVhZFN0cmluZyIsImNoYXIiLCJwZWVrIiwibGluZVN0YXJ0IiwibG9jYXRpb25JbmZvIiwiY29sdW1uIiwiY2FsbCIsImNoYXJDb2RlQXQiLCJjcmVhdGVJTExFR0FMIl0sIm1hcHBpbmdzIjoiOzs7OztrQkFPd0JBLGlCOztBQUp4Qjs7QUFDQTs7QUFDQTs7QUFFZSxTQUFTQSxpQkFBVCxDQUEyQkMsTUFBM0IsRUFBNEQ7QUFDekUsTUFBSUMsTUFBTSxFQUFWO0FBQUEsTUFDRUMsUUFBUSxJQURWO0FBQUEsTUFFRUMsTUFBYyxDQUZoQjtBQUFBLE1BR0VDLFFBQVFKLE9BQU9LLFVBQVAsRUFIVjtBQUFBLE1BSUVDLE9BQU9OLE9BQU9PLElBQVAsRUFKVDtBQUFBLE1BS0VDLFNBTEY7O0FBT0EsU0FBTyxDQUFDLHNCQUFNRixJQUFOLENBQVIsRUFBcUI7QUFDbkIsUUFBSUEsU0FBU0YsS0FBYixFQUFvQjtBQUNsQkosYUFBT0ssVUFBUCxDQUFrQixFQUFFRixHQUFwQjtBQUNBLFVBQUlLLGFBQWEsSUFBakIsRUFBdUIsS0FBS0MsWUFBTCxDQUFrQkMsTUFBbEIsSUFBNEJQLE1BQU1LLFNBQWxDO0FBQ3ZCLGFBQU8sd0JBQWdCLEVBQUVQLEdBQUYsRUFBT0MsS0FBUCxFQUFoQixDQUFQO0FBQ0QsS0FKRCxNQUlPLElBQUlJLFNBQVMsSUFBYixFQUFtQjtBQUN4QixPQUFDTCxHQUFELEVBQU1FLEdBQU4sRUFBV0QsS0FBWCxFQUFrQk0sU0FBbEIsSUFBK0Isd0JBQWlCRyxJQUFqQixDQUM3QixJQUQ2QixFQUU3QlYsR0FGNkIsRUFHN0JELE1BSDZCLEVBSTdCRyxHQUo2QixFQUs3QkQsS0FMNkIsQ0FBL0I7QUFPRCxLQVJNLE1BUUEsSUFBSSw2QkFBaUJJLEtBQUtNLFVBQUwsQ0FBZ0IsQ0FBaEIsQ0FBakIsQ0FBSixFQUEwQztBQUMvQyxZQUFNLEtBQUtDLGFBQUwsQ0FBbUJQLElBQW5CLENBQU47QUFDRCxLQUZNLE1BRUE7QUFDTCxRQUFFSCxHQUFGO0FBQ0FGLGFBQU9LLElBQVA7QUFDRDtBQUNEQSxXQUFPTixPQUFPTyxJQUFQLENBQVlKLEdBQVosQ0FBUDtBQUNEO0FBQ0QsUUFBTSxLQUFLVSxhQUFMLENBQW1CUCxJQUFuQixDQUFOO0FBQ0QiLCJmaWxlIjoicmVhZC1zdHJpbmcuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBAZmxvd1xuaW1wb3J0IHR5cGUgeyBDaGFyU3RyZWFtIH0gZnJvbSAncmVhZHRhYmxlJztcblxuaW1wb3J0IHsgcmVhZFN0cmluZ0VzY2FwZSwgaXNMaW5lVGVybWluYXRvciB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgaXNFT1MgfSBmcm9tICdyZWFkdGFibGUnO1xuaW1wb3J0IHsgU3RyaW5nVG9rZW4gfSBmcm9tICcuLi90b2tlbnMnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZWFkU3RyaW5nTGl0ZXJhbChzdHJlYW06IENoYXJTdHJlYW0pOiBTdHJpbmdUb2tlbiB7XG4gIGxldCBzdHIgPSAnJyxcbiAgICBvY3RhbCA9IG51bGwsXG4gICAgaWR4OiBudW1iZXIgPSAwLFxuICAgIHF1b3RlID0gc3RyZWFtLnJlYWRTdHJpbmcoKSxcbiAgICBjaGFyID0gc3RyZWFtLnBlZWsoKSxcbiAgICBsaW5lU3RhcnQ7XG5cbiAgd2hpbGUgKCFpc0VPUyhjaGFyKSkge1xuICAgIGlmIChjaGFyID09PSBxdW90ZSkge1xuICAgICAgc3RyZWFtLnJlYWRTdHJpbmcoKytpZHgpO1xuICAgICAgaWYgKGxpbmVTdGFydCAhPSBudWxsKSB0aGlzLmxvY2F0aW9uSW5mby5jb2x1bW4gKz0gaWR4IC0gbGluZVN0YXJ0O1xuICAgICAgcmV0dXJuIG5ldyBTdHJpbmdUb2tlbih7IHN0ciwgb2N0YWwgfSk7XG4gICAgfSBlbHNlIGlmIChjaGFyID09PSAnXFxcXCcpIHtcbiAgICAgIFtzdHIsIGlkeCwgb2N0YWwsIGxpbmVTdGFydF0gPSByZWFkU3RyaW5nRXNjYXBlLmNhbGwoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHN0cixcbiAgICAgICAgc3RyZWFtLFxuICAgICAgICBpZHgsXG4gICAgICAgIG9jdGFsLFxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKGlzTGluZVRlcm1pbmF0b3IoY2hhci5jaGFyQ29kZUF0KDApKSkge1xuICAgICAgdGhyb3cgdGhpcy5jcmVhdGVJTExFR0FMKGNoYXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICArK2lkeDtcbiAgICAgIHN0ciArPSBjaGFyO1xuICAgIH1cbiAgICBjaGFyID0gc3RyZWFtLnBlZWsoaWR4KTtcbiAgfVxuICB0aHJvdyB0aGlzLmNyZWF0ZUlMTEVHQUwoY2hhcik7XG59XG4iXX0=