import pino from "pino";

/**
 * Logger utility
 * @module utils/logger
 * @requires pino
 * @type {Object}
 * @const
 * @default
 * @example
 * import logger from "./utils/logger";
 * logger.info("Hello World");
 * logger.error("Hello World");
 * logger.debug("Hello World");
 * logger.warn("Hello World");
 * logger.fatal("Hello World");
 * logger.trace("Hello World");
 * @returns {Object} logger
 * @exports logger
 * @version 1.0
 * @since 1.0
 * @see
 * @description
 * This is a logger utility that uses pino to log messages.
 * It has the following methods:
 * - info
 * - error
 * - debug
 * - warn
 * - fatal
 * - trace
 */

const logger = pino({
  formatters: {
    level(label, number) {
      return { level: label };
    },
  },
});

export default logger;
