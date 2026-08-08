"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUniqueViolation = isUniqueViolation;
exports.isMissingTableError = isMissingTableError;
const typeorm_1 = require("typeorm");
function isNamedError(err, name) {
    return typeof err === 'object' && err !== null && err.name === name;
}
function isQueryFailedErrorLike(err) {
    return err instanceof typeorm_1.QueryFailedError || isNamedError(err, 'QueryFailedError');
}
function isUniqueViolation(err) {
    if (!isQueryFailedErrorLike(err))
        return false;
    const driver = err.driverError;
    const code = driver?.code ?? '';
    const message = driver?.message ?? err.message ?? '';
    return code === '23505' || /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(message);
}
function isMissingTableError(err) {
    if (isQueryFailedErrorLike(err)) {
        const driver = err.driverError;
        if (driver?.code === '42P01')
            return true;
        const message = `${driver?.message ?? ''} ${err.message ?? ''}`;
        return /no such table/i.test(message);
    }
    return isNamedError(err, 'SqliteError') && /no such table/i.test(err.message ?? '');
}
//# sourceMappingURL=db-errors.js.map