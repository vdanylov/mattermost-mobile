// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';

import {observeCanDownloadFiles} from '@queries/servers/file';

import DocumentRenderer from './document_renderer';

import type {WithDatabaseArgs} from '@typings/database/database';

const enhanced = withObservables([], ({database}: WithDatabaseArgs) => {
    return {
        canDownloadFiles: observeCanDownloadFiles(database),
    };
});

export default withDatabase(enhanced(DocumentRenderer));
