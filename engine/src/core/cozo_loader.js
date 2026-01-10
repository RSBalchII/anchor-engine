const path = require('path');
const { IS_PKG } = require('../config/paths');

let CozoDb;

if (IS_PKG) {
    // In PKG mode, we load the native binary from the filesystem next to the EXE
    const nativePath = path.join(path.dirname(process.execPath), 'cozo_node.node');
    try {
        const native = require(nativePath);

        // Minimal CozoDb implementation for PKG mode
        class PkgCozoDb {
            constructor(engine, path, options) {
                this.db_id = native.open_db(engine || 'rocksdb', path || 'data.db', JSON.stringify(options || {}));
            }

            close() {
                native.close_db(this.db_id);
            }

            run(script, params, immutable) {
                return new Promise((resolve, reject) => {
                    params = params || {};
                    native.query_db(this.db_id, script, params, (err, result) => {
                        if (err) {
                            reject(JSON.parse(err));
                        } else {
                            resolve(result);
                        }
                    }, !!immutable);
                });
            }

            // Add other methods if they are used in the codebase
            backup(path) {
                return new Promise((resolve, reject) => {
                    native.backup_db(this.db_id, path, (err) => {
                        if (err) reject(JSON.parse(err)); else resolve();
                    });
                });
            }

            importRelations(data) {
                return new Promise((resolve, reject) => {
                    native.import_relations(this.db_id, data, (err) => {
                        if (err) reject(JSON.parse(err)); else resolve();
                    });
                });
            }
        }
        CozoDb = PkgCozoDb;
        console.log('Loaded native CozoDB binary from:', nativePath);
    } catch (e) {
        console.error('CRITICAL: Failed to load native CozoDB binary.');
        console.error('Ensure cozo_node.node is in the same folder as the executable.');
        console.error('Error:', e.message);
        process.exit(1);
    }
} else {
    // In development mode, use the standard cozo-node package
    try {
        CozoDb = require('cozo-node').CozoDb;
    } catch (e) {
        console.error('Failed to load cozo-node package. Run npm install.');
        throw e;
    }
}

module.exports = { CozoDb };
