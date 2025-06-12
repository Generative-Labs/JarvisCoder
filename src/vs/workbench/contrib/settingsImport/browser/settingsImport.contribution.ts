/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { OperatingSystem, OS } from '../../../../base/common/platform.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { joinPath } from '../../../../base/common/resources.js';
import { IWorkbenchExtensionManagementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionGalleryService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';

/**
 * import vscode settings
 */
class ImportVSCodeSettingsAction extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.importVSCodeSettings',
			title: nls.localize2('importVSCodeSettings', 'Import Settings from VS Code'),
			category: nls.localize2('settings', 'Settings'),
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notificationService = accessor.get(INotificationService);
		const fileService = accessor.get(IFileService);
		const dialogService = accessor.get(IDialogService);
		const userDataProfileService = accessor.get(IUserDataProfileService);
		const pathService = accessor.get(IPathService);
		const extensionManagementService = accessor.get(IWorkbenchExtensionManagementService);
		const extensionGalleryService = accessor.get(IExtensionGalleryService);
		const progressService = accessor.get(IProgressService);

		try {
			// get vscode settings path
			const vscodeSettingsUri = await this.getVSCodeSettingsPath(pathService);

			// check vscode settings file exists
			const vscodeSettingsExists = await fileService.exists(vscodeSettingsUri);
			if (!vscodeSettingsExists) {
				notificationService.error(nls.localize('vscodeSettingsNotFound', 'VS Code settings file not found at: {0}', vscodeSettingsUri.fsPath));
				return;
			}

			// read vscode settings
			const vscodeSettingsContent = await fileService.readFile(vscodeSettingsUri);
			const vscodeSettings = JSON.parse(vscodeSettingsContent.value.toString());

			// read vscode extensions
			const vscodeExtensions = await this.getVSCodeExtensions(pathService, fileService);

			// confirm import operation
			const settingsCount = Object.keys(vscodeSettings).length;
			const extensionsCount = vscodeExtensions.length;
			const result = await dialogService.confirm({
				message: nls.localize('confirmImportVSCode', 'Import {0} settings and {1} extensions from VS Code?', settingsCount, extensionsCount),
				detail: nls.localize('confirmImportVSCodeDetail', 'This will merge VS Code settings and install extensions. Existing settings may be overwritten and new extensions will be installed.'),
				primaryButton: nls.localize('import', 'Import'),
				cancelButton: nls.localize('cancel', 'Cancel')
			});

			if (!result.confirmed) {
				return;
			}

			// get current user settings file path
			const settingsUri = userDataProfileService.currentProfile.settingsResource;
			let currentSettings = {};

			// try to read existing settings
			try {
				const currentSettingsExists = await fileService.exists(settingsUri);
				if (currentSettingsExists) {
					const currentSettingsContent = await fileService.readFile(settingsUri);
					currentSettings = JSON.parse(currentSettingsContent.value.toString());
				}
			} catch (error) {
				// ignore read error, use empty settings object
				currentSettings = {};
			}

			// smart merge settings, ensure no duplicate keys
			const mergedSettings = this.mergeSettings(currentSettings, vscodeSettings);

			// write merged settings
			const settingsContent = JSON.stringify(mergedSettings, null, '\t');
			await fileService.writeFile(settingsUri, VSBuffer.fromString(settingsContent));

			// install extensions
			if (vscodeExtensions.length > 0) {
				await this.installExtensions(vscodeExtensions, extensionManagementService, extensionGalleryService, progressService, notificationService);
			}

			notificationService.info(nls.localize('importVSCodeSuccess', 'Successfully imported {0} settings and {1} extensions from VS Code', settingsCount, extensionsCount));

		} catch (error) {
			notificationService.error(nls.localize('importVSCodeError', 'Failed to import VS Code settings: {0}', error.message));
		}
	}

	private async getVSCodeSettingsPath(pathService: IPathService): Promise<URI> {
		const platform = OS;
		const userHome = await pathService.userHome();

		switch (platform) {
			case OperatingSystem.Windows:
				return joinPath(userHome, 'AppData', 'Roaming', 'Code', 'User', 'settings.json');
			case OperatingSystem.Macintosh:
				return joinPath(userHome, 'Library', 'Application Support', 'Code', 'User', 'settings.json');
			case OperatingSystem.Linux:
			default:
				return joinPath(userHome, '.config', 'Code', 'User', 'settings.json');
		}
	}

	private async getVSCodeExtensions(pathService: IPathService, fileService: IFileService): Promise<string[]> {
		try {
			const platform = OS;
			const userHome = await pathService.userHome();
			let extensionsDir: URI;

			switch (platform) {
				case OperatingSystem.Windows:
					extensionsDir = joinPath(userHome, '.vscode', 'extensions');
					break;
				case OperatingSystem.Macintosh:
					extensionsDir = joinPath(userHome, '.vscode', 'extensions');
					break;
				case OperatingSystem.Linux:
				default:
					extensionsDir = joinPath(userHome, '.vscode', 'extensions');
					break;
			}

			if (await fileService.exists(extensionsDir)) {
				const extensionDirs = await fileService.resolve(extensionsDir);
				const extensionIds: string[] = [];

				for (const child of extensionDirs.children || []) {
					if (child.isDirectory && child.name && child.name.includes('.')) {
						// extension directory name format: publisher.name-version[-platform]
						// extract publisher.name part, use smart parse
						const extensionId = this.parseExtensionId(child.name);
						if (extensionId && !extensionIds.includes(extensionId)) {
							extensionIds.push(extensionId);
						}
					}
				}

				return extensionIds;
			}
		} catch (error) {
			// if read extension directory failed, return empty array
		}
		return [];
	}

	private async installExtensions(
		extensionIds: string[],
		extensionManagementService: IWorkbenchExtensionManagementService,
		extensionGalleryService: IExtensionGalleryService,
		progressService: IProgressService,
		notificationService: INotificationService
	): Promise<void> {
		if (extensionIds.length === 0) {
			return;
		}

		return progressService.withProgress({
			location: ProgressLocation.Notification,
			title: nls.localize('installingExtensions', 'Installing {0} extensions...', extensionIds.length),
			cancellable: true
		}, async (progress) => {
			let installedCount = 0;
			let failedCount = 0;
			const failedExtensions: string[] = [];

			for (const extensionId of extensionIds) {
				try {
					progress.report({
						message: nls.localize('installingExtension', 'Installing {0}...', extensionId),
						increment: (100 / extensionIds.length)
					});

					// try to get extension from gallery
					const galleryExtensions = await extensionGalleryService.getExtensions([{ id: extensionId }], CancellationToken.None);
					const galleryExtension = galleryExtensions[0];

					if (galleryExtension) {
						await extensionManagementService.installFromGallery(galleryExtension, { isMachineScoped: false });
						installedCount++;
					} else {
						failedCount++;
						failedExtensions.push(extensionId);
					}
				} catch (error) {
					failedCount++;
					failedExtensions.push(extensionId);
				}
			}

			let message = '';
			if (installedCount > 0) {
				message += nls.localize('extensionInstallSuccess', 'Successfully installed {0} extensions', installedCount);
			}
			if (failedCount > 0) {
				if (message) {
					message += '. ';
				}
				message += nls.localize('extensionInstallWarning', 'Failed to install {0} extensions: {1}', failedCount, failedExtensions.join(', '));
			}

			notificationService.info(message);
		});
	}

	/**
	 * smart merge settings, avoid duplicate keys
	 */
	private mergeSettings(current: any, imported: any): any {
		const result = JSON.parse(JSON.stringify(current)); // deep copy existing settings

		for (const [key, value] of Object.entries(imported)) {
			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				// if it is an object and not an array, recursively merge
				if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
					result[key] = this.mergeSettings(result[key], value);
				} else {
					result[key] = JSON.parse(JSON.stringify(value)); // deep copy
				}
			} else {
				// directly overwrite original value
				result[key] = value;
			}
		}

		return result;
	}

	/**
	 * parse extension id from extension directory name
	 * directory name format: publisher.name-version[-platform]
	 * return: publisher.name
	 */
	private parseExtensionId(directoryName: string): string {
		// extension directory name format: publisher.name-version[-platform]
		// version number usually starts with a number, so we look for -number pattern
		const versionMatch = directoryName.match(/^(.+)-(\d+\.\d+.*)/);
		if (versionMatch) {
			return versionMatch[1];
		}

		// if version number pattern not found, try to remove part after last dash
		// this can handle cases like some.extension-v1.0.0
		const lastDashIndex = directoryName.lastIndexOf('-');
		if (lastDashIndex > 0) {
			const beforeLastDash = directoryName.substring(0, lastDashIndex);
			// ensure contains dot (publisher.extension format)
			if (beforeLastDash.includes('.')) {
				return beforeLastDash;
			}
		}

		// last fallback
		return directoryName;
	}
}

/**
 * import cursor settings
 */
class ImportCursorSettingsAction extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.importCursorSettings',
			title: nls.localize2('importCursorSettings', 'Import Settings from Cursor'),
			category: nls.localize2('settings', 'Settings'),
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notificationService = accessor.get(INotificationService);
		const fileService = accessor.get(IFileService);
		const dialogService = accessor.get(IDialogService);
		const userDataProfileService = accessor.get(IUserDataProfileService);
		const pathService = accessor.get(IPathService);
		const extensionManagementService = accessor.get(IWorkbenchExtensionManagementService);
		const extensionGalleryService = accessor.get(IExtensionGalleryService);
		const progressService = accessor.get(IProgressService);

		try {
			// get cursor settings path
			const cursorSettingsUri = await this.getCursorSettingsPath(pathService);

			// check cursor settings file exists
			const cursorSettingsExists = await fileService.exists(cursorSettingsUri);
			if (!cursorSettingsExists) {
				notificationService.error(nls.localize('cursorSettingsNotFound', 'Cursor settings file not found at: {0}', cursorSettingsUri.fsPath));
				return;
			}

			// read cursor settings
			const cursorSettingsContent = await fileService.readFile(cursorSettingsUri);
			const cursorSettings = JSON.parse(cursorSettingsContent.value.toString());

			// read cursor extensions
			const cursorExtensions = await this.getCursorExtensions(pathService, fileService);

			// confirm import operation
			const settingsCount = Object.keys(cursorSettings).length;
			const extensionsCount = cursorExtensions.length;
			const result = await dialogService.confirm({
				message: nls.localize('confirmImportCursor', 'Import {0} settings and {1} extensions from Cursor?', settingsCount, extensionsCount),
				detail: nls.localize('confirmImportCursorDetail', 'This will merge Cursor settings and install extensions. Existing settings may be overwritten and new extensions will be installed.'),
				primaryButton: nls.localize('import', 'Import'),
				cancelButton: nls.localize('cancel', 'Cancel')
			});

			if (!result.confirmed) {
				return;
			}

			// get current user settings file path
			const settingsUri = userDataProfileService.currentProfile.settingsResource;
			let currentSettings = {};

			// try to read existing settings
			try {
				const currentSettingsExists = await fileService.exists(settingsUri);
				if (currentSettingsExists) {
					const currentSettingsContent = await fileService.readFile(settingsUri);
					currentSettings = JSON.parse(currentSettingsContent.value.toString());
				}
			} catch (error) {
				// ignore read error, use empty settings object
				currentSettings = {};
			}

			// smart merge settings, ensure no duplicate keys
			const mergedSettings = this.mergeSettings(currentSettings, cursorSettings);

			// write merged settings
			const settingsContent = JSON.stringify(mergedSettings, null, '\t');
			await fileService.writeFile(settingsUri, VSBuffer.fromString(settingsContent));

			// install extensions
			if (cursorExtensions.length > 0) {
				await this.installExtensions(cursorExtensions, extensionManagementService, extensionGalleryService, progressService, notificationService);
			}

			notificationService.info(nls.localize('importCursorSuccess', 'Successfully imported {0} settings and {1} extensions from Cursor', settingsCount, extensionsCount));

		} catch (error) {
			notificationService.error(nls.localize('importCursorError', 'Failed to import Cursor settings: {0}', error.message));
		}
	}

	private async getCursorSettingsPath(pathService: IPathService): Promise<URI> {
		const platform = OS;
		const userHome = await pathService.userHome();

		switch (platform) {
			case OperatingSystem.Windows:
				return joinPath(userHome, 'AppData', 'Roaming', 'Cursor', 'User', 'settings.json');
			case OperatingSystem.Macintosh:
				return joinPath(userHome, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json');
			case OperatingSystem.Linux:
			default:
				return joinPath(userHome, '.config', 'Cursor', 'User', 'settings.json');
		}
	}

	private async getCursorExtensions(pathService: IPathService, fileService: IFileService): Promise<string[]> {
		try {
			const platform = OS;
			const userHome = await pathService.userHome();
			let extensionsDir: URI;

			switch (platform) {
				case OperatingSystem.Windows:
					extensionsDir = joinPath(userHome, '.cursor', 'extensions');
					break;
				case OperatingSystem.Macintosh:
					extensionsDir = joinPath(userHome, '.cursor', 'extensions');
					break;
				case OperatingSystem.Linux:
				default:
					extensionsDir = joinPath(userHome, '.cursor', 'extensions');
					break;
			}

			if (await fileService.exists(extensionsDir)) {
				const extensionDirs = await fileService.resolve(extensionsDir);
				const extensionIds: string[] = [];

				for (const child of extensionDirs.children || []) {
					if (child.isDirectory && child.name && child.name.includes('.')) {
						// extension directory name format: publisher.name-version[-platform]
						// extract publisher.name part, use smart parse
						const extensionId = this.parseExtensionId(child.name);
						if (extensionId && !extensionIds.includes(extensionId)) {
							extensionIds.push(extensionId);
						}
					}
				}

				return extensionIds;
			}
		} catch (error) {
			// if read extension directory failed, return empty array
		}
		return [];
	}

	private async installExtensions(
		extensionIds: string[],
		extensionManagementService: IWorkbenchExtensionManagementService,
		extensionGalleryService: IExtensionGalleryService,
		progressService: IProgressService,
		notificationService: INotificationService
	): Promise<void> {
		if (extensionIds.length === 0) {
			return;
		}

		return progressService.withProgress({
			location: ProgressLocation.Notification,
			title: nls.localize('installingExtensions', 'Installing {0} extensions...', extensionIds.length),
			cancellable: true
		}, async (progress) => {
			let installedCount = 0;
			let failedCount = 0;
			const failedExtensions: string[] = [];

			for (const extensionId of extensionIds) {
				try {
					progress.report({
						message: nls.localize('installingExtension', 'Installing {0}...', extensionId),
						increment: (100 / extensionIds.length)
					});

					// try to get extension from gallery
					const galleryExtensions = await extensionGalleryService.getExtensions([{ id: extensionId }], CancellationToken.None);
					const galleryExtension = galleryExtensions[0];

					if (galleryExtension) {
						await extensionManagementService.installFromGallery(galleryExtension, { isMachineScoped: false });
						installedCount++;
					} else {
						failedCount++;
						failedExtensions.push(extensionId);
					}
				} catch (error) {
					failedCount++;
					failedExtensions.push(extensionId);
				}
			}

			let message = '';
			if (installedCount > 0) {
				message += nls.localize('extensionInstallSuccess', 'Successfully installed {0} extensions', installedCount);
			}
			if (failedCount > 0) {
				if (message) {
					message += '. ';
				}
				message += nls.localize('extensionInstallWarning', 'Failed to install {0} extensions: {1}', failedCount, failedExtensions.join(', '));
			}

			notificationService.info(message);
		});
	}

	/**
	 * smart merge settings, avoid duplicate keys
	 */
	private mergeSettings(current: any, imported: any): any {
		const result = JSON.parse(JSON.stringify(current)); // deep copy existing settings

		for (const [key, value] of Object.entries(imported)) {
			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				// if it is an object and not an array, recursively merge
				if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
					result[key] = this.mergeSettings(result[key], value);
				} else {
					result[key] = JSON.parse(JSON.stringify(value)); // deep copy
				}
			} else {
				// directly overwrite original value
				result[key] = value;
			}
		}

		return result;
	}

	/**
	 * parse extension id from extension directory name
	 * directory name format: publisher.name-version[-platform]
	 * return: publisher.name
	 */
	private parseExtensionId(directoryName: string): string {
		// extension directory name format: publisher.name-version[-platform]
		// version number usually starts with a number, so we look for -number pattern
		const versionMatch = directoryName.match(/^(.+)-(\d+\.\d+.*)/);
		if (versionMatch) {
			return versionMatch[1];
		}

		// if version number pattern not found, try to remove part after last dash
		// this can handle cases like some.extension-v1.0.0
		const lastDashIndex = directoryName.lastIndexOf('-');
		if (lastDashIndex > 0) {
			const beforeLastDash = directoryName.substring(0, lastDashIndex);
			// ensure contains dot (publisher.extension format)
			if (beforeLastDash.includes('.')) {
				return beforeLastDash;
			}
		}

		// last fallback
		return directoryName;
	}
}

// register actions
registerAction2(ImportVSCodeSettingsAction);
registerAction2(ImportCursorSettingsAction);
