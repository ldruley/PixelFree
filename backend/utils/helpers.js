export function mapPhotoRow(row) {
    // tags_json → tags[]
    let tags = [];
    if (row?.tags_json) {
        try {
            const arr = JSON.parse(row.tags_json);
            if (Array.isArray(arr)) tags = arr;
        } catch (_) { /* ignore */ }
    }

    // Shape to the same contract used by /api/photos/query
    return {
        id: row.status_id,           // keep both for convenience
        status_id: row.status_id,
        created_at: row.created_at || null,

        author: {
            id: row.author_id ?? null,
            acct: row.author_acct ?? null,
            username: row.author_username ?? null,
            display_name: row.author_display ?? null,
            avatar: row.author_avatar ?? null,
        },
        author_display_name: row.author_display ?? null,

        caption: row.caption_html ?? null,  // your client uses captionHtml OR content
        post_url: row.post_url ?? null,

        tags,                              // normalized array

        url: row.url ?? null,
        preview_url: row.preview_url ?? row.url ?? null,

        // If you later left-join a media manifest, map to local_path here
        local_path: row.local_path ?? null
    };
}