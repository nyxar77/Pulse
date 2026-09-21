package io.github.nyxar77.pulse;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "ScopedBackup")
public class ScopedBackupPlugin extends Plugin {
    private static final String PREFERENCE_FILE = "pulse_scoped_backup";
    private static final String URI_KEY = "folder_uri";
    private static final String LABEL_KEY = "folder_label";
    private static final String FILE_NAME = "pulse-ledger.json";
    private static final String PREVIOUS_FILE_NAME = "pulse-ledger.previous.json";
    private static final String MIME_TYPE = "application/json";

    @PluginMethod
    public void chooseFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION |
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        startActivityForResult(call, intent, "folderResult");
    }

    @ActivityCallback
    private void folderResult(PluginCall call, ActivityResult result) {
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject response = new JSObject();
            response.put("selected", false);
            call.resolve(response);
            return;
        }

        Uri uri = data.getData();
        int resultFlags = data.getFlags();
        boolean hasReadAccess = (resultFlags & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0;
        boolean hasWriteAccess = (resultFlags & Intent.FLAG_GRANT_WRITE_URI_PERMISSION) != 0;
        if (!hasReadAccess || !hasWriteAccess) {
            call.reject("The selected folder did not grant read and write access.");
            return;
        }
        try {
            String previousUriValue = preferences().getString(URI_KEY, null);
            getContext().getContentResolver().takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
            String label = folderLabel(uri);
            preferences().edit().putString(URI_KEY, uri.toString()).putString(LABEL_KEY, label).apply();
            if (previousUriValue != null && !previousUriValue.equals(uri.toString())) {
                releasePersistedAccess(Uri.parse(previousUriValue));
            }
            JSObject response = new JSObject();
            response.put("selected", true);
            response.put("folderName", label);
            response.put("filename", FILE_NAME);
            call.resolve(response);
        } catch (SecurityException error) {
            call.reject("Pulse could not keep access to that folder.", error);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        String uriValue = preferences().getString(URI_KEY, null);
        JSObject response = new JSObject();
        boolean selected = uriValue != null && hasPersistedAccess(Uri.parse(uriValue));
        response.put("selected", selected);
        response.put("folderName", selected ? preferences().getString(LABEL_KEY, "Selected folder") : "");
        response.put("filename", FILE_NAME);
        call.resolve(response);
    }

    @PluginMethod
    public void clearFolder(PluginCall call) {
        String uriValue = preferences().getString(URI_KEY, null);
        if (uriValue != null) {
            releasePersistedAccess(Uri.parse(uriValue));
        }
        preferences().edit().clear().apply();
        call.resolve();
    }

    @PluginMethod
    public void writeBackup(PluginCall call) {
        String contents = call.getString("contents");
        boolean preservePrevious = Boolean.TRUE.equals(call.getBoolean("preservePrevious", false));
        if (contents == null) {
            call.reject("Backup contents are required.");
            return;
        }

        execute(() -> {
            String uriValue = preferences().getString(URI_KEY, null);
            if (uriValue == null) {
                call.reject("Choose a backup folder first.");
                return;
            }
            Uri treeUri = Uri.parse(uriValue);
            if (!hasPersistedAccess(treeUri)) {
                call.reject("Pulse no longer has access to the selected folder. Choose it again.");
                return;
            }

            try {
                boolean previousCreated = replaceBackup(treeUri, contents, preservePrevious);
                JSObject response = new JSObject();
                response.put("savedAt", System.currentTimeMillis());
                response.put("folderName", preferences().getString(LABEL_KEY, "Selected folder"));
                response.put("filename", FILE_NAME);
                response.put("previousCreated", previousCreated);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Could not write the Pulse backup: " + error.getMessage(), error);
            }
        });
    }

    private boolean replaceBackup(Uri treeUri, String contents, boolean preservePrevious) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        Uri current = findDocument(treeUri, FILE_NAME);
        boolean previousCreated = false;

        if (preservePrevious && current != null) {
            replaceNamedCopySafely(treeUri, current, PREVIOUS_FILE_NAME, "previous");
            previousCreated = true;
        }

        String operationId = Long.toUnsignedString(System.nanoTime());
        Uri pending = createDocument(treeUri, ".pulse-ledger.pending-" + operationId + ".json");
        try (OutputStream output = resolver.openOutputStream(pending, "wt")) {
            if (output == null) throw new IOException("The selected folder refused the write.");
            output.write(contents.getBytes(StandardCharsets.UTF_8));
            output.flush();
        }

        Uri recovery = null;
        try {
            if (current != null) {
                recovery = createDocument(treeUri, ".pulse-ledger.recovery-" + operationId + ".json");
                copy(resolver, current, recovery);
                deleteDocument(resolver, current, "The existing backup could not be prepared for replacement.");
            }

            promoteDocument(treeUri, pending, FILE_NAME);
            if (recovery != null) deleteDocumentQuietly(resolver, recovery);
        } catch (Exception replacementError) {
            if (recovery != null && findDocument(treeUri, FILE_NAME) == null) {
                Uri restored = null;
                try {
                    restored = createDocument(treeUri, FILE_NAME);
                    copy(resolver, recovery, restored);
                } catch (Exception restoreError) {
                    if (restored != null) deleteDocumentQuietly(resolver, restored);
                    replacementError.addSuppressed(restoreError);
                }
            }
            if (replacementError instanceof IOException) throw (IOException) replacementError;
            throw new IOException("The selected folder could not replace the backup safely.", replacementError);
        }
        return previousCreated;
    }

    private void replaceNamedCopySafely(Uri treeUri, Uri source, String targetName, String temporaryLabel) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        String temporaryName = ".pulse-ledger." + temporaryLabel + "-" + Long.toUnsignedString(System.nanoTime()) + ".json";
        Uri temporary = createDocument(treeUri, temporaryName);
        copy(resolver, source, temporary);

        Uri existing = findDocument(treeUri, targetName);
        if (existing != null) deleteDocument(resolver, existing, targetName + " could not be replaced.");
        promoteDocument(treeUri, temporary, targetName);
    }

    private Uri createDocument(Uri treeUri, String name) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        String parentId = DocumentsContract.getTreeDocumentId(treeUri);
        Uri parent = DocumentsContract.buildDocumentUriUsingTree(treeUri, parentId);
        Uri created = DocumentsContract.createDocument(resolver, parent, MIME_TYPE, name);
        if (created == null) throw new IOException(name + " could not be created.");
        return created;
    }

    private void promoteDocument(Uri treeUri, Uri source, String targetName) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        try {
            Uri renamed = DocumentsContract.renameDocument(resolver, source, targetName);
            if (renamed != null) return;
        } catch (RuntimeException ignored) {
            // Some document providers do not implement rename. Copy below instead.
        }

        Uri target = null;
        try {
            target = createDocument(treeUri, targetName);
            copy(resolver, source, target);
            deleteDocumentQuietly(resolver, source);
        } catch (Exception error) {
            if (target != null) deleteDocumentQuietly(resolver, target);
            if (error instanceof IOException) throw (IOException) error;
            throw new IOException(targetName + " could not be created safely.", error);
        }
    }

    private void deleteDocument(ContentResolver resolver, Uri document, String message) throws IOException {
        try {
            if (!DocumentsContract.deleteDocument(resolver, document)) throw new IOException(message);
        } catch (RuntimeException error) {
            throw new IOException(message, error);
        }
    }

    private void deleteDocumentQuietly(ContentResolver resolver, Uri document) {
        try {
            DocumentsContract.deleteDocument(resolver, document);
        } catch (Exception ignored) {
            // A harmless temporary recovery file is preferable to risking the backup.
        }
    }

    private Uri findDocument(Uri treeUri, String name) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        String parentId = DocumentsContract.getTreeDocumentId(treeUri);
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentId);
        String[] projection = { DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME };
        try (Cursor cursor = resolver.query(children, projection, null, null, null)) {
            if (cursor == null) return null;
            int idColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
            int nameColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
            while (cursor.moveToNext()) {
                if (name.equals(cursor.getString(nameColumn))) {
                    return DocumentsContract.buildDocumentUriUsingTree(treeUri, cursor.getString(idColumn));
                }
            }
        } catch (RuntimeException error) {
            throw new IOException("The selected folder could not be read.", error);
        }
        return null;
    }

    private void copy(ContentResolver resolver, Uri source, Uri destination) throws IOException {
        try (InputStream input = resolver.openInputStream(source); OutputStream output = resolver.openOutputStream(destination, "wt")) {
            if (input == null || output == null) throw new IOException("The backup provider refused a file operation.");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            output.flush();
        }
    }

    private boolean hasPersistedAccess(Uri uri) {
        return getContext().getContentResolver().getPersistedUriPermissions().stream().anyMatch(permission ->
            permission.getUri().equals(uri) && permission.isReadPermission() && permission.isWritePermission()
        );
    }

    private void releasePersistedAccess(Uri uri) {
        try {
            getContext().getContentResolver().releasePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
        } catch (SecurityException ignored) {
            // Access may already have been removed from Android settings.
        }
    }

    private String folderLabel(Uri uri) {
        try {
            String id = DocumentsContract.getTreeDocumentId(uri);
            int separator = id.indexOf(':');
            String volume = separator >= 0 ? id.substring(0, separator) : "Storage";
            String path = separator >= 0 ? id.substring(separator + 1) : id;
            String root = "primary".equalsIgnoreCase(volume) ? "Internal storage" : volume;
            return path.isEmpty() ? root : root + "/" + path;
        } catch (RuntimeException error) {
            return "Selected folder";
        }
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCE_FILE, Context.MODE_PRIVATE);
    }
}
