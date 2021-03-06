'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = readIdentifier;

var _utils = require('./utils');

var _readtable = require('readtable');

var _tokens = require('../tokens');

let terminates;

const startsEscape = code => {
  if (code === 0x005c /* backslash */) return true;
  return 0xd800 <= code && code <= 0xdbff;
};

function readIdentifier(stream) {
  terminates = (0, _utils.isTerminating)((0, _readtable.getCurrentReadtable)());
  let char = stream.peek();
  let code = char.charCodeAt(0);
  let check = _utils.isIdentifierStart;

  // If the first char is invalid
  if (!check(code) && !startsEscape(code)) {
    throw this.createError('Invalid or unexpected token');
  }

  let idx = 0;
  while (!terminates(char) && !(0, _readtable.isEOS)(char)) {
    if (startsEscape(code)) {
      return new _tokens.IdentifierToken({
        value: getEscapedIdentifier.call(this, stream)
      });
    }
    if (!check(code)) {
      return new _tokens.IdentifierToken({
        value: stream.readString(idx)
      });
    }
    char = stream.peek(++idx);
    code = char.charCodeAt(0);
    check = _utils.isIdentifierPart;
  }
  return new _tokens.IdentifierToken({
    value: stream.readString(idx)
  });
}

function getEscapedIdentifier(stream) {
  const sPeek = stream.peek.bind(stream);
  let id = '';
  let check = _utils.isIdentifierStart;
  let char = sPeek();
  let code = char.charCodeAt(0);
  while (!terminates(char) && !(0, _readtable.isEOS)(char)) {
    let streamRead = false;
    if (char === '\\') {
      let nxt = sPeek(1);
      if ((0, _readtable.isEOS)(nxt)) {
        throw this.createILLEGAL(char);
      }
      if (nxt !== 'u') {
        throw this.createILLEGAL(char);
      }
      code = (0, _utils.scanUnicode)(stream, 2);
      streamRead = true;
      if (code < 0) {
        throw this.createILLEGAL(char);
      }
    } else if (0xd800 <= code && code <= 0xdbff) {
      if ((0, _readtable.isEOS)(char)) {
        throw this.createILLEGAL(char);
      }
      let lowSurrogateCode = sPeek(1).charCodeAt(0);
      if (0xdc00 > lowSurrogateCode || lowSurrogateCode > 0xdfff) {
        throw this.createILLEGAL(char);
      }
      stream.readString(2);
      code = decodeUtf16(code, lowSurrogateCode);
      streamRead = true;
    }
    if (!check(code)) {
      if (id.length < 1) {
        throw this.createILLEGAL(char);
      }
      return id;
    }

    if (!streamRead) stream.readString();

    id += String.fromCodePoint(code);
    char = sPeek();
    code = char.charCodeAt(0);
    check = _utils.isIdentifierPart;
  }
  return id;
}

function decodeUtf16(lead, trail) {
  return (lead - 0xd800) * 0x400 + (trail - 0xdc00) + 0x10000;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yZWFkZXIvcmVhZC1pZGVudGlmaWVyLmpzIl0sIm5hbWVzIjpbInJlYWRJZGVudGlmaWVyIiwidGVybWluYXRlcyIsInN0YXJ0c0VzY2FwZSIsImNvZGUiLCJzdHJlYW0iLCJjaGFyIiwicGVlayIsImNoYXJDb2RlQXQiLCJjaGVjayIsImNyZWF0ZUVycm9yIiwiaWR4IiwidmFsdWUiLCJnZXRFc2NhcGVkSWRlbnRpZmllciIsImNhbGwiLCJyZWFkU3RyaW5nIiwic1BlZWsiLCJiaW5kIiwiaWQiLCJzdHJlYW1SZWFkIiwibnh0IiwiY3JlYXRlSUxMRUdBTCIsImxvd1N1cnJvZ2F0ZUNvZGUiLCJkZWNvZGVVdGYxNiIsImxlbmd0aCIsIlN0cmluZyIsImZyb21Db2RlUG9pbnQiLCJsZWFkIiwidHJhaWwiXSwibWFwcGluZ3MiOiI7Ozs7O2tCQWtCd0JBLGM7O0FBaEJ4Qjs7QUFFQTs7QUFHQTs7QUFJQSxJQUFJQyxVQUFKOztBQUVBLE1BQU1DLGVBQWVDLFFBQVE7QUFDM0IsTUFBSUEsU0FBUyxNQUFiLENBQW9CLGVBQXBCLEVBQXFDLE9BQU8sSUFBUDtBQUNyQyxTQUFPLFVBQVVBLElBQVYsSUFBa0JBLFFBQVEsTUFBakM7QUFDRCxDQUhEOztBQUtlLFNBQVNILGNBQVQsQ0FBd0JJLE1BQXhCLEVBQTRDO0FBQ3pESCxlQUFhLDBCQUFjLHFDQUFkLENBQWI7QUFDQSxNQUFJSSxPQUFPRCxPQUFPRSxJQUFQLEVBQVg7QUFDQSxNQUFJSCxPQUFPRSxLQUFLRSxVQUFMLENBQWdCLENBQWhCLENBQVg7QUFDQSxNQUFJQyxnQ0FBSjs7QUFFQTtBQUNBLE1BQUksQ0FBQ0EsTUFBTUwsSUFBTixDQUFELElBQWdCLENBQUNELGFBQWFDLElBQWIsQ0FBckIsRUFBeUM7QUFDdkMsVUFBTSxLQUFLTSxXQUFMLENBQWlCLDZCQUFqQixDQUFOO0FBQ0Q7O0FBRUQsTUFBSUMsTUFBTSxDQUFWO0FBQ0EsU0FBTyxDQUFDVCxXQUFXSSxJQUFYLENBQUQsSUFB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QTJCQyxLQUEzQixFQUFrQztBQUNoQyxTQUFPLENBQUNELE9BQU8sTUFBUixJQUFrQixLQUFsQixJQUEyQkMsUUFBUSxNQUFuQyxJQUE2QyxPQUFwRDtBQUNEIiwiZmlsZSI6InJlYWQtaWRlbnRpZmllci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEBmbG93XG5cbmltcG9ydCB7IHNjYW5Vbmljb2RlIH0gZnJvbSAnLi91dGlscyc7XG5cbmltcG9ydCB7IGlzRU9TLCBnZXRDdXJyZW50UmVhZHRhYmxlIH0gZnJvbSAncmVhZHRhYmxlJztcbmltcG9ydCB0eXBlIHsgQ2hhclN0cmVhbSB9IGZyb20gJ3JlYWR0YWJsZSc7XG5cbmltcG9ydCB7IElkZW50aWZpZXJUb2tlbiB9IGZyb20gJy4uL3Rva2Vucyc7XG5cbmltcG9ydCB7IGlzVGVybWluYXRpbmcsIGlzSWRlbnRpZmllclBhcnQsIGlzSWRlbnRpZmllclN0YXJ0IH0gZnJvbSAnLi91dGlscyc7XG5cbmxldCB0ZXJtaW5hdGVzO1xuXG5jb25zdCBzdGFydHNFc2NhcGUgPSBjb2RlID0+IHtcbiAgaWYgKGNvZGUgPT09IDB4MDA1YyAvKiBiYWNrc2xhc2ggKi8pIHJldHVybiB0cnVlO1xuICByZXR1cm4gMHhkODAwIDw9IGNvZGUgJiYgY29kZSA8PSAweGRiZmY7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZWFkSWRlbnRpZmllcihzdHJlYW06IENoYXJTdHJlYW0pIHtcbiAgdGVybWluYXRlcyA9IGlzVGVybWluYXRpbmcoZ2V0Q3VycmVudFJlYWR0YWJsZSgpKTtcbiAgbGV0IGNoYXIgPSBzdHJlYW0ucGVlaygpO1xuICBsZXQgY29kZSA9IGNoYXIuY2hhckNvZGVBdCgwKTtcbiAgbGV0IGNoZWNrID0gaXNJZGVudGlmaWVyU3RhcnQ7XG5cbiAgLy8gSWYgdGhlIGZpcnN0IGNoYXIgaXMgaW52YWxpZFxuICBpZiAoIWNoZWNrKGNvZGUpICYmICFzdGFydHNFc2NhcGUoY29kZSkpIHtcbiAgICB0aHJvdyB0aGlzLmNyZWF0ZUVycm9yKCdJbnZhbGlkIG9yIHVuZXhwZWN0ZWQgdG9rZW4nKTtcbiAgfVxuXG4gIGxldCBpZHggPSAwO1xuICB3aGlsZSAoIXRlcm1pbmF0ZXMoY2hhcikgJiYgIWlzRU9TKGNoYXIpKSB7XG4gICAgaWYgKHN0YXJ0c0VzY2FwZShjb2RlKSkge1xuICAgICAgcmV0dXJuIG5ldyBJZGVudGlmaWVyVG9rZW4oe1xuICAgICAgICB2YWx1ZTogZ2V0RXNjYXBlZElkZW50aWZpZXIuY2FsbCh0aGlzLCBzdHJlYW0pLFxuICAgICAgfSk7XG4gICAgfVxuICAgIGlmICghY2hlY2soY29kZSkpIHtcbiAgICAgIHJldHVybiBuZXcgSWRlbnRpZmllclRva2VuKHtcbiAgICAgICAgdmFsdWU6IHN0cmVhbS5yZWFkU3RyaW5nKGlkeCksXG4gICAgICB9KTtcbiAgICB9XG4gICAgY2hhciA9IHN0cmVhbS5wZWVrKCsraWR4KTtcbiAgICBjb2RlID0gY2hhci5jaGFyQ29kZUF0KDApO1xuICAgIGNoZWNrID0gaXNJZGVudGlmaWVyUGFydDtcbiAgfVxuICByZXR1cm4gbmV3IElkZW50aWZpZXJUb2tlbih7XG4gICAgdmFsdWU6IHN0cmVhbS5yZWFkU3RyaW5nKGlkeCksXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBnZXRFc2NhcGVkSWRlbnRpZmllcihzdHJlYW0pIHtcbiAgY29uc3Qgc1BlZWsgPSBzdHJlYW0ucGVlay5iaW5kKHN0cmVhbSk7XG4gIGxldCBpZCA9ICcnO1xuICBsZXQgY2hlY2sgPSBpc0lkZW50aWZpZXJTdGFydDtcbiAgbGV0IGNoYXIgPSBzUGVlaygpO1xuICBsZXQgY29kZSA9IGNoYXIuY2hhckNvZGVBdCgwKTtcbiAgd2hpbGUgKCF0ZXJtaW5hdGVzKGNoYXIpICYmICFpc0VPUyhjaGFyKSkge1xuICAgIGxldCBzdHJlYW1SZWFkID0gZmFsc2U7XG4gICAgaWYgKGNoYXIgPT09ICdcXFxcJykge1xuICAgICAgbGV0IG54dCA9IHNQZWVrKDEpO1xuICAgICAgaWYgKGlzRU9TKG54dCkpIHtcbiAgICAgICAgdGhyb3cgdGhpcy5jcmVhdGVJTExFR0FMKGNoYXIpO1xuICAgICAgfVxuICAgICAgaWYgKG54dCAhPT0gJ3UnKSB7XG4gICAgICAgIHRocm93IHRoaXMuY3JlYXRlSUxMRUdBTChjaGFyKTtcbiAgICAgIH1cbiAgICAgIGNvZGUgPSBzY2FuVW5pY29kZShzdHJlYW0sIDIpO1xuICAgICAgc3RyZWFtUmVhZCA9IHRydWU7XG4gICAgICBpZiAoY29kZSA8IDApIHtcbiAgICAgICAgdGhyb3cgdGhpcy5jcmVhdGVJTExFR0FMKGNoYXIpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoMHhkODAwIDw9IGNvZGUgJiYgY29kZSA8PSAweGRiZmYpIHtcbiAgICAgIGlmIChpc0VPUyhjaGFyKSkge1xuICAgICAgICB0aHJvdyB0aGlzLmNyZWF0ZUlMTEVHQUwoY2hhcik7XG4gICAgICB9XG4gICAgICBsZXQgbG93U3Vycm9nYXRlQ29kZSA9IHNQZWVrKDEpLmNoYXJDb2RlQXQoMCk7XG4gICAgICBpZiAoMHhkYzAwID4gbG93U3Vycm9nYXRlQ29kZSB8fCBsb3dTdXJyb2dhdGVDb2RlID4gMHhkZmZmKSB7XG4gICAgICAgIHRocm93IHRoaXMuY3JlYXRlSUxMRUdBTChjaGFyKTtcbiAgICAgIH1cbiAgICAgIHN0cmVhbS5yZWFkU3RyaW5nKDIpO1xuICAgICAgY29kZSA9IGRlY29kZVV0ZjE2KGNvZGUsIGxvd1N1cnJvZ2F0ZUNvZGUpO1xuICAgICAgc3RyZWFtUmVhZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICghY2hlY2soY29kZSkpIHtcbiAgICAgIGlmIChpZC5sZW5ndGggPCAxKSB7XG4gICAgICAgIHRocm93IHRoaXMuY3JlYXRlSUxMRUdBTChjaGFyKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpZDtcbiAgICB9XG5cbiAgICBpZiAoIXN0cmVhbVJlYWQpIHN0cmVhbS5yZWFkU3RyaW5nKCk7XG5cbiAgICBpZCArPSBTdHJpbmcuZnJvbUNvZGVQb2ludChjb2RlKTtcbiAgICBjaGFyID0gc1BlZWsoKTtcbiAgICBjb2RlID0gY2hhci5jaGFyQ29kZUF0KDApO1xuICAgIGNoZWNrID0gaXNJZGVudGlmaWVyUGFydDtcbiAgfVxuICByZXR1cm4gaWQ7XG59XG5cbmZ1bmN0aW9uIGRlY29kZVV0ZjE2KGxlYWQsIHRyYWlsKSB7XG4gIHJldHVybiAobGVhZCAtIDB4ZDgwMCkgKiAweDQwMCArICh0cmFpbCAtIDB4ZGMwMCkgKyAweDEwMDAwO1xufVxuIl19