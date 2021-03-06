'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isClassDeclaration = exports.isFunctionDeclaration = exports.isCompiletimeStatement = exports.isSyntaxDeclarationStatement = exports.isVariableDeclarationStatement = exports.isSyntaxVariableDeclartion = exports.isVariableDeclarator = exports.isVariableDeclaration = exports.isExportLocals = exports.isExportFrom = exports.isExportDefault = exports.isExport = exports.isExportDeclaration = exports.isImportDeclaration = undefined;

var _sweetSpec = require('sweet-spec');

var T = _interopRequireWildcard(_sweetSpec);

var _ramda = require('ramda');

var _ = _interopRequireWildcard(_ramda);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

const isImportDeclaration = exports.isImportDeclaration = _.is(T.ImportDeclaration);

const isExportDeclaration = exports.isExportDeclaration = _.is(T.ExportDeclaration);
const isExport = exports.isExport = _.is(T.Export);
const isExportDefault = exports.isExportDefault = _.is(T.ExportDefault);
const isExportFrom = exports.isExportFrom = _.is(T.ExportFrom);
const isExportLocals = exports.isExportLocals = _.is(T.ExportLocals);

const isVariableDeclaration = exports.isVariableDeclaration = _.is(T.VariableDeclaration);
const isVariableDeclarator = exports.isVariableDeclarator = _.is(T.VariableDeclarator);
const isSyntaxVariableDeclartion = exports.isSyntaxVariableDeclartion = _.both(isVariableDeclaration, _.either(_.propEq('kind', 'syntax'), _.propEq('kind', 'syntaxrec')));

const isVariableDeclarationStatement = exports.isVariableDeclarationStatement = _.is(T.VariableDeclarationStatement);
const isSyntaxDeclarationStatement = exports.isSyntaxDeclarationStatement = term => {
  // syntax m = ...
  // syntaxrec m = ...
  return isVariableDeclarationStatement(term) && term.declaration.type === 'VariableDeclaration' && (term.declaration.kind === 'syntax' || term.declaration.kind === 'syntaxrec' || term.declaration.kind === 'operator');
};

const isCompiletimeStatement = exports.isCompiletimeStatement = isSyntaxDeclarationStatement;

const isFunctionDeclaration = exports.isFunctionDeclaration = _.is(T.FunctionDeclaration);
const isClassDeclaration = exports.isClassDeclaration = _.is(T.ClassDeclaration);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zd2VldC1zcGVjLXV0aWxzLmpzIl0sIm5hbWVzIjpbIlQiLCJfIiwiaXNJbXBvcnREZWNsYXJhdGlvbiIsImlzIiwiSW1wb3J0RGVjbGFyYXRpb24iLCJpc0V4cG9ydERlY2xhcmF0aW9uIiwiRXhwb3J0RGVjbGFyYXRpb24iLCJpc0V4cG9ydCIsIkV4cG9ydCIsImlzRXhwb3J0RGVmYXVsdCIsIkV4cG9ydERlZmF1bHQiLCJpc0V4cG9ydEZyb20iLCJFeHBvcnRGcm9tIiwiaXNFeHBvcnRMb2NhbHMiLCJFeHBvcnRMb2NhbHMiLCJpc1ZhcmlhYmxlRGVjbGFyYXRpb24iLCJWYXJpYWJsZURlY2xhcmF0aW9uIiwiaXNWYXJpYWJsZURlY2xhcmF0b3IiLCJWYXJpYWJsZURlY2xhcmF0b3IiLCJpc1N5bnRheFZhcmlhYmxlRGVjbGFydGlvbiIsImJvdGgiLCJlaXRoZXIiLCJwcm9wRXEiLCJpc1ZhcmlhYmxlRGVjbGFyYXRpb25TdGF0ZW1lbnQiLCJWYXJpYWJsZURlY2xhcmF0aW9uU3RhdGVtZW50IiwiaXNTeW50YXhEZWNsYXJhdGlvblN0YXRlbWVudCIsInRlcm0iLCJkZWNsYXJhdGlvbiIsInR5cGUiLCJraW5kIiwiaXNDb21waWxldGltZVN0YXRlbWVudCIsImlzRnVuY3Rpb25EZWNsYXJhdGlvbiIsIkZ1bmN0aW9uRGVjbGFyYXRpb24iLCJpc0NsYXNzRGVjbGFyYXRpb24iLCJDbGFzc0RlY2xhcmF0aW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBRUE7O0lBQVlBLEM7O0FBQ1o7O0lBQVlDLEM7Ozs7QUFFTCxNQUFNQyxvREFBc0JELEVBQUVFLEVBQUYsQ0FBS0gsRUFBRUksaUJBQVAsQ0FBNUI7O0FBRUEsTUFBTUMsb0RBQXNCSixFQUFFRSxFQUFGLENBQUtILEVBQUVNLGlCQUFQLENBQTVCO0FBQ0EsTUFBTUMsOEJBQVdOLEVBQUVFLEVBQUYsQ0FBS0gsRUFBRVEsTUFBUCxDQUFqQjtBQUNBLE1BQU1DLDRDQUFrQlIsRUFBRUUsRUFBRixDQUFLSCxFQUFFVSxhQUFQLENBQXhCO0FBQ0EsTUFBTUMsc0NBQWVWLEVBQUVFLEVBQUYsQ0FBS0gsRUFBRVksVUFBUCxDQUFyQjtBQUNBLE1BQU1DLDBDQUFpQlosRUFBRUUsRUFBRixDQUFLSCxFQUFFYyxZQUFQLENBQXZCOztBQUVBLE1BQU1DLHdEQUF3QmQsRUFBRUUsRUFBRixDQUFLSCxFQUFFZ0IsbUJBQVAsQ0FBOUI7QUFDQSxNQUFNQyxzREFBdUJoQixFQUFFRSxFQUFGLENBQUtILEVBQUVrQixrQkFBUCxDQUE3QjtBQUNBLE1BQU1DLGtFQUE2QmxCLEVBQUVtQixJQUFGLENBQ3hDTCxxQkFEd0MsRUFFeENkLEVBQUVvQixNQUFGLENBQVNwQixFQUFFcUIsTUFBRixDQUFTLE1BQVQsRUFBaUIsUUFBakIsQ0FBVCxFQUFxQ3JCLEVBQUVxQixNQUFGLENBQVMsTUFBVCxFQUFpQixXQUFqQixDQUFyQyxDQUZ3QyxDQUFuQzs7QUFLQSxNQUFNQywwRUFBaUN0QixFQUFFRSxFQUFGLENBQzVDSCxFQUFFd0IsNEJBRDBDLENBQXZDO0FBR0EsTUFBTUMsc0VBQWdDQyxJQUFELElBQWU7QUFDekQ7QUFDQTtBQUNBLFNBQ0VILCtCQUErQkcsSUFBL0IsS0FDQUEsS0FBS0MsV0FBTCxDQUFpQkMsSUFBakIsS0FBMEIscUJBRDFCLEtBRUNGLEtBQUtDLFdBQUwsQ0FBaUJFLElBQWpCLEtBQTBCLFFBQTFCLElBQ0NILEtBQUtDLFdBQUwsQ0FBaUJFLElBQWpCLEtBQTBCLFdBRDNCLElBRUNILEtBQUtDLFdBQUwsQ0FBaUJFLElBQWpCLEtBQTBCLFVBSjVCLENBREY7QUFPRCxDQVZNOztBQVlBLE1BQU1DLDBEQUF5QkwsNEJBQS9COztBQUVBLE1BQU1NLHdEQUF3QjlCLEVBQUVFLEVBQUYsQ0FBS0gsRUFBRWdDLG1CQUFQLENBQTlCO0FBQ0EsTUFBTUMsa0RBQXFCaEMsRUFBRUUsRUFBRixDQUFLSCxFQUFFa0MsZ0JBQVAsQ0FBM0IiLCJmaWxlIjoic3dlZXQtc3BlYy11dGlscy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEBmbG93XG5cbmltcG9ydCAqIGFzIFQgZnJvbSAnc3dlZXQtc3BlYyc7XG5pbXBvcnQgKiBhcyBfIGZyb20gJ3JhbWRhJztcblxuZXhwb3J0IGNvbnN0IGlzSW1wb3J0RGVjbGFyYXRpb24gPSBfLmlzKFQuSW1wb3J0RGVjbGFyYXRpb24pO1xuXG5leHBvcnQgY29uc3QgaXNFeHBvcnREZWNsYXJhdGlvbiA9IF8uaXMoVC5FeHBvcnREZWNsYXJhdGlvbik7XG5leHBvcnQgY29uc3QgaXNFeHBvcnQgPSBfLmlzKFQuRXhwb3J0KTtcbmV4cG9ydCBjb25zdCBpc0V4cG9ydERlZmF1bHQgPSBfLmlzKFQuRXhwb3J0RGVmYXVsdCk7XG5leHBvcnQgY29uc3QgaXNFeHBvcnRGcm9tID0gXy5pcyhULkV4cG9ydEZyb20pO1xuZXhwb3J0IGNvbnN0IGlzRXhwb3J0TG9jYWxzID0gXy5pcyhULkV4cG9ydExvY2Fscyk7XG5cbmV4cG9ydCBjb25zdCBpc1ZhcmlhYmxlRGVjbGFyYXRpb24gPSBfLmlzKFQuVmFyaWFibGVEZWNsYXJhdGlvbik7XG5leHBvcnQgY29uc3QgaXNWYXJpYWJsZURlY2xhcmF0b3IgPSBfLmlzKFQuVmFyaWFibGVEZWNsYXJhdG9yKTtcbmV4cG9ydCBjb25zdCBpc1N5bnRheFZhcmlhYmxlRGVjbGFydGlvbiA9IF8uYm90aChcbiAgaXNWYXJpYWJsZURlY2xhcmF0aW9uLFxuICBfLmVpdGhlcihfLnByb3BFcSgna2luZCcsICdzeW50YXgnKSwgXy5wcm9wRXEoJ2tpbmQnLCAnc3ludGF4cmVjJykpLFxuKTtcblxuZXhwb3J0IGNvbnN0IGlzVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudCA9IF8uaXMoXG4gIFQuVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudCxcbik7XG5leHBvcnQgY29uc3QgaXNTeW50YXhEZWNsYXJhdGlvblN0YXRlbWVudCA9ICh0ZXJtOiBhbnkpID0+IHtcbiAgLy8gc3ludGF4IG0gPSAuLi5cbiAgLy8gc3ludGF4cmVjIG0gPSAuLi5cbiAgcmV0dXJuIChcbiAgICBpc1ZhcmlhYmxlRGVjbGFyYXRpb25TdGF0ZW1lbnQodGVybSkgJiZcbiAgICB0ZXJtLmRlY2xhcmF0aW9uLnR5cGUgPT09ICdWYXJpYWJsZURlY2xhcmF0aW9uJyAmJlxuICAgICh0ZXJtLmRlY2xhcmF0aW9uLmtpbmQgPT09ICdzeW50YXgnIHx8XG4gICAgICB0ZXJtLmRlY2xhcmF0aW9uLmtpbmQgPT09ICdzeW50YXhyZWMnIHx8XG4gICAgICB0ZXJtLmRlY2xhcmF0aW9uLmtpbmQgPT09ICdvcGVyYXRvcicpXG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgaXNDb21waWxldGltZVN0YXRlbWVudCA9IGlzU3ludGF4RGVjbGFyYXRpb25TdGF0ZW1lbnQ7XG5cbmV4cG9ydCBjb25zdCBpc0Z1bmN0aW9uRGVjbGFyYXRpb24gPSBfLmlzKFQuRnVuY3Rpb25EZWNsYXJhdGlvbik7XG5leHBvcnQgY29uc3QgaXNDbGFzc0RlY2xhcmF0aW9uID0gXy5pcyhULkNsYXNzRGVjbGFyYXRpb24pO1xuIl19