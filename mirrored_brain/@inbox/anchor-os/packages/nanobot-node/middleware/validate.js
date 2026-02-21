/**
 * Request Validation Middleware (Lightweight)
 * 
 * Validates request body fields against a simple declarative schema.
 * No external dependencies.
 */

/**
 * Validate a value against a field schema
 */
function validateField(field, value, schema) {
  if (value === undefined || value === null) {
    if (schema.required) return `'${field}' is required`;
    return null;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) return `'${field}' must be an array`;
    if (schema.itemType) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== schema.itemType) {
          return `'${field}[${i}]' must be of type '${schema.itemType}'`;
        }
      }
    }
  } else if (typeof value !== schema.type) {
    return `'${field}' must be of type '${schema.type}', got '${typeof value}'`;
  }

  if (schema.type === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      return `'${field}' must be at least ${schema.minLength} characters`;
    }
  }

  if (schema.type === 'number') {
    if (schema.min !== undefined && value < schema.min) return `'${field}' must be >= ${schema.min}`;
    if (schema.max !== undefined && value > schema.max) return `'${field}' must be <= ${schema.max}`;
  }

  return null;
}

/**
 * Create validation middleware from a body schema
 * @param {Record<string, Object>} schema
 * @returns {import('express').RequestHandler}
 */
export function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, fieldSchema] of Object.entries(schema)) {
      const error = validateField(field, req.body[field], fieldSchema);
      if (error) errors.push(error);
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
  };
}

export const schemas = {
  chatCompletions: {
    messages: { type: 'array', required: true },
    temperature: { type: 'number', required: false, min: 0, max: 2 },
    max_tokens: { type: 'number', required: false, min: 1, max: 128000 }
  },
  modelLoad: {
    model: { type: 'string', required: true, minLength: 1 }
  },
  completions: {
    prompt: { type: 'string', required: true, minLength: 1 }
  },
  memorySearch: {
    term: { type: 'string', required: true, minLength: 1 }
  }
};
