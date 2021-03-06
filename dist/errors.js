'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.expect = expect;
exports.assert = assert;
function expect(cond, message, offendingSyntax, rest) {
  if (!cond) {
    let ctx = '';
    if (rest) {
      ctx = rest.slice(0, 20).map(s => {
        let val = s.isDelimiter() ? '( ... )' : s.val();
        if (s === offendingSyntax) {
          return '__' + val + '__';
        }
        return val;
      }).join(' ');
    }
    throw new Error('[error]: ' + message + '\n' + ctx);
  }
}

function assert(cond, message) {
  if (!cond) {
    throw new Error('[assertion error]: ' + message);
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9lcnJvcnMuanMiXSwibmFtZXMiOlsiZXhwZWN0IiwiYXNzZXJ0IiwiY29uZCIsIm1lc3NhZ2UiLCJvZmZlbmRpbmdTeW50YXgiLCJyZXN0IiwiY3R4Iiwic2xpY2UiLCJtYXAiLCJzIiwidmFsIiwiaXNEZWxpbWl0ZXIiLCJqb2luIiwiRXJyb3IiXSwibWFwcGluZ3MiOiI7Ozs7O1FBQWdCQSxNLEdBQUFBLE07UUFtQkFDLE0sR0FBQUEsTTtBQW5CVCxTQUFTRCxNQUFULENBQWdCRSxJQUFoQixFQUFzQkMsT0FBdEIsRUFBK0JDLGVBQS9CLEVBQWdEQyxJQUFoRCxFQUFzRDtBQUMzRCxNQUFJLENBQUNILElBQUwsRUFBVztBQUNULFFBQUlJLE1BQU0sRUFBVjtBQUNBLFFBQUlELElBQUosRUFBVTtBQUNSQyxZQUFNRCxLQUNIRSxLQURHLENBQ0csQ0FESCxFQUNNLEVBRE4sRUFFSEMsR0FGRyxDQUVDQyxLQUFLO0FBQ1IsWUFBSUMsTUFBTUQsRUFBRUUsV0FBRixLQUFrQixTQUFsQixHQUE4QkYsRUFBRUMsR0FBRixFQUF4QztBQUNBLFlBQUlELE1BQU1MLGVBQVYsRUFBMkI7QUFDekIsaUJBQU8sT0FBT00sR0FBUCxHQUFhLElBQXBCO0FBQ0Q7QUFDRCxlQUFPQSxHQUFQO0FBQ0QsT0FSRyxFQVNIRSxJQVRHLENBU0UsR0FURixDQUFOO0FBVUQ7QUFDRCxVQUFNLElBQUlDLEtBQUosQ0FBVSxjQUFjVixPQUFkLEdBQXdCLElBQXhCLEdBQStCRyxHQUF6QyxDQUFOO0FBQ0Q7QUFDRjs7QUFFTSxTQUFTTCxNQUFULENBQWdCQyxJQUFoQixFQUFzQkMsT0FBdEIsRUFBK0I7QUFDcEMsTUFBSSxDQUFDRCxJQUFMLEVBQVc7QUFDVCxVQUFNLElBQUlXLEtBQUosQ0FBVSx3QkFBd0JWLE9BQWxDLENBQU47QUFDRDtBQUNGIiwiZmlsZSI6ImVycm9ycy5qcyIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBleHBlY3QoY29uZCwgbWVzc2FnZSwgb2ZmZW5kaW5nU3ludGF4LCByZXN0KSB7XG4gIGlmICghY29uZCkge1xuICAgIGxldCBjdHggPSAnJztcbiAgICBpZiAocmVzdCkge1xuICAgICAgY3R4ID0gcmVzdFxuICAgICAgICAuc2xpY2UoMCwgMjApXG4gICAgICAgIC5tYXAocyA9PiB7XG4gICAgICAgICAgbGV0IHZhbCA9IHMuaXNEZWxpbWl0ZXIoKSA/ICcoIC4uLiApJyA6IHMudmFsKCk7XG4gICAgICAgICAgaWYgKHMgPT09IG9mZmVuZGluZ1N5bnRheCkge1xuICAgICAgICAgICAgcmV0dXJuICdfXycgKyB2YWwgKyAnX18nO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdmFsO1xuICAgICAgICB9KVxuICAgICAgICAuam9pbignICcpO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1tlcnJvcl06ICcgKyBtZXNzYWdlICsgJ1xcbicgKyBjdHgpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnQoY29uZCwgbWVzc2FnZSkge1xuICBpZiAoIWNvbmQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1thc3NlcnRpb24gZXJyb3JdOiAnICsgbWVzc2FnZSk7XG4gIH1cbn1cbiJdfQ==