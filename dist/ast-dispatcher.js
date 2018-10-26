'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
class ASTDispatcher {
  constructor(prefix, errorIfMissing) {
    this.errorIfMissing = errorIfMissing;
    this.prefix = prefix;
  }

  dispatch(term) {
    let field = this.prefix + term.type;
    if (typeof this[field] === 'function') {
      return this[field](term);
    } else if (!this.errorIfMissing) {
      return term;
    }
    throw new Error(`Missing implementation for: ${field}`);
  }
}
exports.default = ASTDispatcher;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9hc3QtZGlzcGF0Y2hlci5qcyJdLCJuYW1lcyI6WyJBU1REaXNwYXRjaGVyIiwiY29uc3RydWN0b3IiLCJwcmVmaXgiLCJlcnJvcklmTWlzc2luZyIsImRpc3BhdGNoIiwidGVybSIsImZpZWxkIiwidHlwZSIsIkVycm9yIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFlLE1BQU1BLGFBQU4sQ0FBb0I7QUFDakNDLGNBQVlDLE1BQVosRUFBb0JDLGNBQXBCLEVBQW9DO0FBQ2xDLFNBQUtBLGNBQUwsR0FBc0JBLGNBQXRCO0FBQ0EsU0FBS0QsTUFBTCxHQUFjQSxNQUFkO0FBQ0Q7O0FBRURFLFdBQVNDLElBQVQsRUFBZTtBQUNiLFFBQUlDLFFBQVEsS0FBS0osTUFBTCxHQUFjRyxLQUFLRSxJQUEvQjtBQUNBLFFBQUksT0FBTyxLQUFLRCxLQUFMLENBQVAsS0FBdUIsVUFBM0IsRUFBdUM7QUFDckMsYUFBTyxLQUFLQSxLQUFMLEVBQVlELElBQVosQ0FBUDtBQUNELEtBRkQsTUFFTyxJQUFJLENBQUMsS0FBS0YsY0FBVixFQUEwQjtBQUMvQixhQUFPRSxJQUFQO0FBQ0Q7QUFDRCxVQUFNLElBQUlHLEtBQUosQ0FBVywrQkFBOEJGLEtBQU0sRUFBL0MsQ0FBTjtBQUNEO0FBZGdDO2tCQUFkTixhIiwiZmlsZSI6ImFzdC1kaXNwYXRjaGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQVNURGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKHByZWZpeCwgZXJyb3JJZk1pc3NpbmcpIHtcbiAgICB0aGlzLmVycm9ySWZNaXNzaW5nID0gZXJyb3JJZk1pc3Npbmc7XG4gICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gIH1cblxuICBkaXNwYXRjaCh0ZXJtKSB7XG4gICAgbGV0IGZpZWxkID0gdGhpcy5wcmVmaXggKyB0ZXJtLnR5cGU7XG4gICAgaWYgKHR5cGVvZiB0aGlzW2ZpZWxkXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIHRoaXNbZmllbGRdKHRlcm0pO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZXJyb3JJZk1pc3NpbmcpIHtcbiAgICAgIHJldHVybiB0ZXJtO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYE1pc3NpbmcgaW1wbGVtZW50YXRpb24gZm9yOiAke2ZpZWxkfWApO1xuICB9XG59XG4iXX0=