/*******************************************************************************

Highcharts Export Server

Copyright (c) 2016-2022, Highsoft

Licenced under the MIT licence.

Additionally a valid Highcharts license is required for use.

See LICENSE file in root for details.

*******************************************************************************/

require('colors');

const { existsSync, mkdirSync, readdirSync, writeFileSync } = require('fs');
const { join } = require('path');

const exporter = require('../lib/index.js');
const { mergeConfigOptions } = require('../lib/utils.js');
const { initDefaultOptions } = require('../lib/config');
const { defaultConfig } = require('../lib/schemas/config.js');

(async () => {
  console.log(
    'Highcharts Export Server Automagic Test Runner'.yellow,
    '\nLoads all JSON files from the ./test/files folder and runs them',
    '(results are stored in the ./test/results).\n'
  );

  let failsCouter = 0;

  // Get files names
  const files = readdirSync(join(__dirname, 'files'));

  // Get the default options
  const defaultOptions = initDefaultOptions(defaultConfig);

  // Disable export server logging
  defaultOptions.logging.level = 0;
  defaultOptions.pool.queueSize = files.length;

  // Init pool with the default options
  await exporter.initPool(defaultOptions);

  Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map((file) =>
        new Promise((resolve, reject) => {
          console.log('[Test runner]'.blue, `Processing test ${file}.`);

          // Set the start time
          const startTime = new Date().getTime();

          // Options from a file
          const fileOptions = require(join(__dirname, 'files', file));

          // Get the content of a file and merge it into the default options
          const options = mergeConfigOptions(
            Object.assign({}, defaultOptions),
            fileOptions,
            ['options']
          );

          // Create the results path if it doesn't exist yet
          const resultsPath = join(__dirname, 'results');
          !existsSync(resultsPath) && mkdirSync(resultsPath);

          // Prepare an outfile path
          options.export.outfile = join(
            resultsPath,
            file.replace('.json', '.png')
          );

          // Start the export process
          exporter.startExport(options, (info, error) => {
            // Set the end time
            const endTime = new Date().getTime();

            // Create a message
            let message = `Done with ${file} - time: ${endTime - startTime}ms`;

            // Information about the results and the time it took
            console.log(
              '[Test runner]'.blue,
              error
                ? `${message}, error: ${error}`.red
                : `${message}, success.`.green
            );

            // Try to save to a file
            if (!error) {
              // Save returned data to a correct image file if no error occured
              writeFileSync(
                info.options.export.outfile,
                Buffer.from(info.data, 'base64')
              );
            }

            return error ? reject(failsCouter) : resolve();
          });
        }).catch(() => {
          failsCouter++;
        })
      )
  ).then(() => {
    console.log(
      '\n---------------------------',
      failsCouter
        ? `\nAll done, ${failsCouter} error(s) found!`.red
        : '\nAll done, errors not found!'.green,
      '\n---------------------------'
    );
    exporter.killPool();
  });
})();
