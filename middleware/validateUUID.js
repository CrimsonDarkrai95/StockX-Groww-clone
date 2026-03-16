// middleware/validateUUID.js
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * validateUUID(paramName)
 * Checks req.params[paramName] OR req.body[paramName] for a valid UUID.
 * Returns 400 { success, data, error } if invalid.
 */
function validateUUID(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName] ?? req.body[paramName];

    if (!value || !UUID_REGEX.test(value)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid ID format',
      });
    }

    next();
  };
}

module.exports = validateUUID;