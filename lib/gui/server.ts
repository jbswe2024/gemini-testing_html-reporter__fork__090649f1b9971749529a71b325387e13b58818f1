import path from 'path';
import express from 'express';
import {onExit} from 'signal-exit';
import BluebirdPromise from 'bluebird';
import bodyParser from 'body-parser';
import {INTERNAL_SERVER_ERROR, OK} from 'http-codes';

import {App} from './app';
import {MAX_REQUEST_SIZE, KEEP_ALIVE_TIMEOUT, HEADERS_TIMEOUT} from './constants';
import {logger} from '../common-utils';
import {initPluginsRoutes} from './routes/plugins';
import {ServerArgs} from './index';
import {ServerReadyData} from './api';
import {ToolName} from '../constants';

export const start = async (args: ServerArgs): Promise<ServerReadyData> => {
    const {toolAdapter} = args;
    const {reporterConfig, guiApi} = toolAdapter;

    if (!guiApi) {
        throw new Error('Gui API must be initialized before starting gui server');
    }

    const app = App.create(args);
    const server = express();

    server.use(bodyParser.json({limit: MAX_REQUEST_SIZE}));

    await guiApi.initServer(server);

    // allow plugins to precede default server routes
    server.use(initPluginsRoutes(express.Router(), reporterConfig));

    server.use(express.static(path.join(__dirname, '../static'), {index: 'gui.html'}));
    server.use(express.static(path.join(process.cwd(), reporterConfig.path)));

    server.get('/', (_req, res) => res.sendFile(path.join(__dirname, '../static', 'gui.html')));

    server.get('/events', (_req, res) => {
        res.writeHead(OK, {'Content-Type': 'text/event-stream'});

        app.addClient(res);
    });

    server.set('json replacer', (_key: string, val: unknown) => {
        return typeof val === 'function' ? val.toString() : val;
    });

    server.get('/init', async (_req, res) => {
        try {
            if (toolAdapter.toolName === ToolName.Testplane) {
                await toolAdapter.initGuiHandler();
            }

            res.json(app.data);
        } catch (e: unknown) {
            const error = e as Error;
            if (!app.data) {
                throw new Error(`Failed to initialize custom GUI ${error.message}`);
            }
            res.json({
                ...app.data,
                customGuiError: {
                    response: {
                        status: INTERNAL_SERVER_ERROR,
                        data: `Error while trying to initialize custom GUI: ${error.message}`
                    }
                }
            });
        }
    });

    server.post('/run', (req, res) => {
        try {
            // do not wait for completion so that response does not hang and browser does not restart it by timeout
            app.run(req.body);
            res.sendStatus(OK);
        } catch (e) {
            res.status(INTERNAL_SERVER_ERROR).send(`Error while trying to run tests: ${(e as Error).message}`);
        }
    });

    server.post('/run-custom-gui-action', async ({body: payload}, res) => {
        try {
            if (toolAdapter.toolName === ToolName.Testplane) {
                await toolAdapter.runCustomGuiAction(payload);
            }

            res.sendStatus(OK);
        } catch (e) {
            res.status(INTERNAL_SERVER_ERROR).send(`Error while running custom gui action: ${(e as Error).message}`);
        }
    });

    server.post('/reference-data-to-update', (req, res) => {
        try {
            const data = app.getTestsDataToUpdateRefs(req.body);
            res.json(data);
        } catch (error) {
            res.status(INTERNAL_SERVER_ERROR).send({error: (error as Error).message});
        }
    });

    server.post('/update-reference', (req, res) => {
        app.updateReferenceImage(req.body)
            .then((updatedTests) => res.json(updatedTests))
            .catch(({message}) => res.status(INTERNAL_SERVER_ERROR).send({error: message}));
    });

    server.post('/undo-accept-images', (req, res) => {
        app.undoAcceptImages(req.body)
            .then((updated) => res.json(updated))
            .catch(({message}) => res.status(INTERNAL_SERVER_ERROR).send({error: message}));
    });

    server.post('/get-find-equal-diffs-data', (req, res) => {
        try {
            const data = app.getImageDataToFindEqualDiffs(req.body);
            res.json(data);
        } catch (e) {
            res.status(INTERNAL_SERVER_ERROR).send({error: (e as Error).message});
        }
    });

    server.post('/find-equal-diffs', async (req, res) => {
        try {
            const result = await app.findEqualDiffs(req.body);
            res.json(result);
        } catch (e) {
            res.status(INTERNAL_SERVER_ERROR).send({error: (e as Error).message});
        }
    });

    onExit(() => {
        app.finalize();
        logger.log('server shutting down');
    });

    server.post('/stop', (_req, res) => {
        try {
            // pass 0 to prevent terminating testplane process
            toolAdapter.halt(new Error('Tests were stopped by the user'), 0);
            res.sendStatus(OK);
        } catch (e) {
            res.status(INTERNAL_SERVER_ERROR).send(`Error while stopping tests: ${(e as Error).message}`);
        }
    });

    await app.initialize();

    const {port, hostname} = args.cli.options;
    await BluebirdPromise.fromCallback((callback) => {
        const httpServer = server.listen(port, hostname, callback as () => void);
        httpServer.keepAliveTimeout = KEEP_ALIVE_TIMEOUT;
        httpServer.headersTimeout = HEADERS_TIMEOUT;
    });

    const data = {url: `http://${hostname}:${port}`};

    await guiApi.serverReady(data);

    return data;
};
