import { handleFetch } from './handlers/fetch';
import { handleScheduled } from './handlers/scheduled';

export default {
  fetch: handleFetch,
  scheduled: handleScheduled,
};
