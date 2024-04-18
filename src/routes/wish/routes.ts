import { type Express } from 'express';

import { getGachaConfigList } from '../../utils/hoyolab';
import { sendErrorResponse, sendSuccessResponse } from '../../utils/sendResponse';
import { logToConsole } from '../../utils/log';
import { wishHistoryQueue } from '../../queues/wishHistoryQueue';

export class WishHistoryRoute {
	constructor(private readonly app: Express) {}

	setupRoutes(): void {
		this.app.get('/wishhistory', async (req, res) => {
			if (req.user === undefined) {
				return sendErrorResponse(res, 500, 'MISSING_USER');
			}

			const runningJob = await wishHistoryQueue.getJob(req.user.providerId + 'wish');

			if (runningJob !== undefined) {
				return sendSuccessResponse(res, { state: 'IN_PROGRESS' });
			}

			const authkey =
				typeof req.query.authkey === 'string'
					? decodeURIComponent(req.query.authkey)
					: null;

			if (authkey === null || authkey === '') {
				return sendErrorResponse(res, 400, 'MISSING_AUTHKEY');
			}

			const configResponse = await getGachaConfigList(authkey);

			if (configResponse.retcode !== 0 || configResponse.data === null) {
				sendErrorResponse(res, 500, 'AUTHKEY_INVALID');
				logToConsole('/wishhistory', configResponse.message);
				return;
			}

			await wishHistoryQueue.add(
				'FETCH_WISH_HISTORY',
				{
					authkey,
					providerId: req.user.providerId
				},
				{
					jobId: req.user.providerId + 'wish',
					removeOnComplete: 3600, //remove after one hour
					removeOnFail: true
				}
			);

			sendSuccessResponse(res, { state: 'CREATED' });
		});
	}
}