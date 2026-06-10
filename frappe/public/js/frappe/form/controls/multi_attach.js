frappe.ui.form.ControlMultiAttach = class ControlMultiAttach extends frappe.ui.form.ControlAttach {
	make_input() {
		let me = this;

		this.$input = $('<button class="btn btn-default btn-sm btn-attach">')
			.html(__("Attach"))
			.prependTo(me.input_area)
			.on("click", () => me.on_attach_click());

		this.$value = $(
			`<div class="attached-file flex justify-between align-center">
				<div class="ellipsis">
					${frappe.utils.icon("es-line-link", "sm")}
					<span class="attached-file-count"></span>
				</div>
				<div>
					<a class="btn btn-xs btn-default" data-action="manage_attachments">${__("Manage")}</a>
					<a class="btn btn-xs btn-default" data-action="clear_attachment">${__("Clear All")}</a>
				</div>
			</div>`
		)
			.prependTo(me.input_area)
			.toggle(false);

		this.$new_doc_msg = $(
			`<p class="text-muted small">${__("Save the document first to add attachments.")}</p>`
		)
			.prependTo(me.input_area)
			.toggle(false);

		this.input = this.$input.get(0);
		this.set_input_attributes();
		this.has_input = true;
		frappe.utils.bind_actions_with_object(this.$value, this);
	}

	refresh() {
		super.refresh();
		if (this.frm && this.frm.is_new()) {
			this.$input.toggle(false);
			this.$value.toggle(false);
			this.$new_doc_msg.toggle(true);
		} else {
			this.$new_doc_msg.toggle(false);
			this.set_input(this.value);
		}
		const canEdit = !(this.frm?.doc?.docstatus == 1) || this.df.allow_on_submit;
		this.$value.find("[data-action='clear_attachment']").prop("disabled", !canEdit);
	}

	// --- Helpers ---

	get_max_attachments() {
		return this.df.max_attachments || 5;
	}

	get_multiple_values() {
		if (!this.value) return [];
		try {
			const parsed = JSON.parse(this.value);
			return Array.isArray(parsed) ? parsed.filter(Boolean) : [this.value];
		} catch {
			return this.value ? [this.value] : [];
		}
	}

	// --- Upload options ---

	set_upload_options() {
		super.set_upload_options();
		this.upload_options.allow_multiple = true;
		this.upload_options.restrictions = this.upload_options.restrictions || {};
		this.upload_options.restrictions.max_number_of_files = this.get_max_attachments();
		this.upload_options.on_success = (file) => {
			this.on_upload_complete(file);
		};
	}

	// --- Click handler ---

	on_attach_click() {
		if (this.get_multiple_values().length > 0) {
			this.open_manage_dialog();
		} else {
			this.set_upload_options();
			this.file_uploader = new frappe.ui.FileUploader(this.upload_options);
		}
	}

	// --- Field value display ---

	set_input(value) {
		this.last_value = this.value;
		this.value = value;
		const urls = this.get_multiple_values();
		if (urls.length > 0) {
			this.$input.toggle(false);
			this.$value
				.toggle(true)
				.find(".attached-file-count")
				.text(__("{0} file(s) attached", [urls.length]));
		} else {
			this.$input.toggle(true);
			this.$value.toggle(false);
		}
	}

	get_value() {
		return this.value || null;
	}

	// --- Upload complete ---

	on_upload_complete(attachment) {
		this._pending_urls = this._pending_urls || [];
		this._pending_urls.push(attachment.file_url);
		clearTimeout(this._flush_timer);
		this._flush_timer = setTimeout(() => this._flush_pending_urls(), 300);
	}

	async _flush_pending_urls() {
		if (!this._pending_urls?.length) return;
		const incoming = this._pending_urls.splice(0);
		const urls = [...new Set([...this.get_multiple_values(), ...incoming])];
		const new_value = JSON.stringify(urls);
		try {
			if (this.frm) {
				await this.parse_validate_and_set_in_model(new_value);
				this.frm.doc.docstatus == 1 ? this.frm.save("Update") : this.frm.save();
			}
			this.set_value(new_value);
			if (this.manage_dialog?.display) this.refresh_manage_dialog();
		} catch (e) {
			console.error("Multi Attach: flush failed", e);
			frappe.show_alert({
				message: __("Some attachments could not be saved."),
				indicator: "orange",
			});
		}
	}

	// --- Manage dialog ---

	manage_attachments() {
		this.open_manage_dialog();
	}

	open_manage_dialog() {
		this.manage_dialog = new frappe.ui.Dialog({
			title: __("Manage Attachments"),
			fields: [{ fieldtype: "HTML", fieldname: "attachments_html" }],
		});

		this.refresh_manage_dialog();

		this.manage_dialog.set_primary_action(__("Add More"), () => {
			const remaining = this.get_max_attachments() - this.get_multiple_values().length;
			if (remaining <= 0) {
				frappe.msgprint(__("Maximum {0} attachments allowed.", [this.get_max_attachments()]));
				return;
			}
			this.set_upload_options();
			this.upload_options.allow_multiple = remaining > 1;
			this.upload_options.restrictions.max_number_of_files = remaining;
			this.file_uploader = new frappe.ui.FileUploader(this.upload_options);
		});

		this.manage_dialog.set_secondary_action(() => this.manage_dialog.hide());
		this.manage_dialog.set_secondary_action_label(__("Close"));
		this.manage_dialog.show();
	}

	refresh_manage_dialog() {
		if (!this.manage_dialog) return;
		const gen = (this._privacy_gen = (this._privacy_gen || 0) + 1);
		const urls = this.get_multiple_values();
		const $wrapper = this.manage_dialog.get_field("attachments_html").$wrapper;
		$wrapper.empty();

		const canEdit = !(this.frm?.doc?.docstatus == 1) || this.df.allow_on_submit;

		if (urls.length === 0) {
			$wrapper.html(`<p class="text-muted">${__("No attachments yet.")}</p>`);
		} else {
			urls.forEach((url) => {
				const filename = url.split("/").pop();
				const eu = frappe.utils.escape_html(url);
				const ef = frappe.utils.escape_html(filename);
				const $row = $(`
					<div class="attached-file flex justify-between align-center" style="margin-bottom:6px">
						<div class="ellipsis">
							${frappe.utils.icon("es-line-link", "sm")}
							<a href="${eu}" target="_blank">${ef}</a>
						</div>
						<div style="flex-shrink:0;white-space:nowrap">
							<button class="btn btn-xs btn-default btn-preview" data-url="${eu}">${__("Preview")}</button>
							<button class="btn btn-xs btn-default btn-reload" data-url="${eu}">${__("Reload")}</button>
							<button class="btn btn-xs btn-danger btn-remove" data-url="${eu}">${__("Remove")}</button>
						</div>
					</div>
				`);
				if (!canEdit) {
					$row.find(".btn-reload, .btn-remove").prop("disabled", true);
				}
				$row.find(".btn-remove").on("click", () => this.remove_file(url));
				$row.find(".btn-reload").on("click", () => this.reload_file(url));
				$row.find(".btn-preview").on("click", () => this.preview_file(url));
				$wrapper.append($row);
			});
		}

		const used = urls.length;
		const max = this.get_max_attachments();
		$wrapper.append(
			`<p class="text-muted small mt-2">${__("{0} of {1} slots used.", [used, max])}</p>`
		);

		if (this.manage_dialog.$primary_action) {
			this.manage_dialog.$primary_action.prop("disabled", used >= max || !canEdit);
		}

		if (this.frm && urls.length > 0) {
			this.fetch_file_privacy(urls, (files) => {
				if (gen !== this._privacy_gen) return;
				if (!files || !files.length) return;
				const allPrivate = files.every((f) => f.is_private);
				const icon = frappe.utils.icon(allPrivate ? "es-line-lock" : "es-line-unlock", "sm");
				const statusText = allPrivate ? __("Files are private") : __("Files are public");
				const btnLabel = allPrivate ? __("Make all public") : __("Make all private");
				const targetPrivate = allPrivate ? 0 : 1;
				const $privacy = $(`
					<div class="border-top pt-2 mt-2 flex justify-between align-center">
						<span class="text-muted small">${icon} ${statusText}</span>
						<button class="btn btn-xs btn-default btn-toggle-privacy">${btnLabel}</button>
					</div>
				`);
				$privacy.find(".btn-toggle-privacy").on("click", () => this.toggle_all_privacy(targetPrivate));
				$wrapper.append($privacy);
			});
		}
	}

	fetch_file_privacy(urls, callback) {
		if (!this.frm || !urls.length) {
			callback([]);
			return;
		}
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "File",
				filters: {
					file_url: ["in", urls],
					attached_to_name: this.frm.doc.name,
					attached_to_doctype: this.frm.doc.doctype,
					attached_to_field: this.df.fieldname,
				},
				fields: ["name", "file_url", "is_private"],
				limit: 100,
			},
			callback: (r) => callback(r.message || []),
		});
	}

	toggle_all_privacy(is_private) {
		if (!this.frm) return;
		frappe.call({
			method: "frappe.core.doctype.file.utils.toggle_multi_attach_privacy",
			args: {
				doctype: this.frm.doc.doctype,
				docname: this.frm.doc.name,
				fieldname: this.df.fieldname,
				is_private: is_private,
			},
			freeze: true,
			freeze_message: __("Updating file access..."),
			callback: async (r) => {
				if (r.message) {
					const new_value = r.message.length ? JSON.stringify(r.message) : null;
					await this.parse_validate_and_set_in_model(new_value);
					this.set_value(new_value);
					this.refresh_manage_dialog();
					frappe.show_alert({
						message: is_private ? __("All files are now private.") : __("All files are now public."),
						indicator: "green",
					});
				}
			},
		});
	}

	// --- Per-file actions ---

	preview_file(url) {
		const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"];
		const ext = url.split(".").pop().toLowerCase().split("?")[0];
		const filename = frappe.utils.escape_html(url.split("/").pop());

		if (IMAGE_EXTS.includes(ext)) {
			const preview = new frappe.ui.Dialog({
				title: filename,
				fields: [{ fieldtype: "HTML", fieldname: "preview_html" }],
			});
			preview.get_field("preview_html").$wrapper.html(
				`<div style="text-align:center;padding:10px">
					<img src="${frappe.utils.escape_html(url)}"
						style="max-width:100%;max-height:70vh;border-radius:4px" />
				</div>`
			);
			preview.show();
		} else if (ext === "pdf") {
			const preview = new frappe.ui.Dialog({
				title: filename,
				fields: [{ fieldtype: "HTML", fieldname: "preview_html" }],
			});
			preview.get_field("preview_html").$wrapper.html(
				`<iframe src="${frappe.utils.escape_html(url)}"
					style="width:100%;height:70vh;border:none"></iframe>`
			);
			preview.show();
		} else {
			window.open(url, "_blank");
		}
	}

	remove_file(url) {
		frappe.confirm(__("Remove this attachment?"), async () => {
			const urls = this.get_multiple_values().filter((u) => u !== url);
			const new_value = urls.length ? JSON.stringify(urls) : null;
			if (this.frm) {
				this.frm.attachments.remove_attachment_by_filename(url, async () => {
					await this.parse_validate_and_set_in_model(new_value);
					this.refresh();
					this.frm.doc.docstatus == 1 ? this.frm.save("Update") : this.frm.save();
					this.refresh_manage_dialog();
				});
			} else {
				this.set_input(new_value);
				this.parse_validate_and_set_in_model(new_value);
				this.refresh_manage_dialog();
			}
		});
	}

	reload_file(old_url) {
		this.set_upload_options();
		this.upload_options.allow_multiple = false;
		this.upload_options.restrictions.max_number_of_files = 1;
		this.upload_options.on_success = async (attachment) => {
			try {
				const urls = this.get_multiple_values().map((u) =>
					u === old_url ? attachment.file_url : u
				);
				const new_value = JSON.stringify(urls);
				if (this.frm) {
					await this.parse_validate_and_set_in_model(new_value);
					this.frm.doc.docstatus == 1 ? this.frm.save("Update") : this.frm.save();
				}
				this.set_value(new_value);
				this.refresh_manage_dialog();
			} catch (e) {
				console.error("Multi Attach: reload failed", attachment?.file_url, e);
				frappe.show_alert({
					message: __("Could not reload {0}.", [attachment?.file_url || ""]),
					indicator: "orange",
				});
			}
		};
		this.file_uploader = new frappe.ui.FileUploader(this.upload_options);
	}

	// --- Clear all ---

	clear_attachment() {
		const me = this;
		frappe.confirm(__("Delete all attachments?"), async function () {
			if (me.frm) {
				for (const url of me.get_multiple_values()) {
					me.frm.attachments.remove_attachment_by_filename(url, () => {});
				}
				await me.parse_validate_and_set_in_model(null);
				me.refresh();
				me.frm.doc.docstatus == 1 ? me.frm.save("Update") : me.frm.save();
			} else {
				me.set_input(null);
				me.parse_validate_and_set_in_model(null);
				me.refresh();
			}
			if (me.manage_dialog) me.manage_dialog.hide();
		});
	}
};
