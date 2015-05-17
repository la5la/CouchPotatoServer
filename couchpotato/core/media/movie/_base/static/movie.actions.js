var MovieAction = new Class({

	Implements: [Options],

	class_name: 'action',
	label: 'UNKNOWN',
	button: null,
	details: null,
	detail_button: null,

	initialize: function(movie, options){
		var self = this;
		self.setOptions(options);

		self.movie = movie;

		self.create();

		if(self.button)
			self.button.addClass(self.class_name);
	},

	create: function(){},

	getButton: function(){
		return this.button || null;
	},

	getDetails: function(){
		return this.details || null;
	},

	getDetailButton: function(){
		return this.detail_button || null;
	},

	getLabel: function(){
		return this.label;
	},

	disable: function(){
		if(this.el)
			this.el.addClass('disable');
	},

	enable: function(){
		if(this.el)
			this.el.removeClass('disable');
	},

	getTitle: function(){
		var self = this;

		try {
			return self.movie.getTitle();
		}
		catch(e){
			try {
				return self.movie.original_title ? self.movie.original_title : self.movie.titles[0];
			}
			catch(e2){
				return 'Unknown';
			}
		}
	},

	get: function(key){
		var self = this;
		try {
			return self.movie.get(key);
		}
		catch(e){
			return self.movie[key];
		}
	},

	createMask: function(){
		var self = this;
		self.mask = new Element('div.mask', {
			'styles': {
				'z-index': '1'
			}
		}).inject(self.movie, 'top').fade('hide');
	},

	toElement: function(){
		return this.el || null;
	}

});

var MA = {};

MA.IMDB = new Class({

	Extends: MovieAction,
	id: null,

	create: function(){
		var self = this;

		self.id = self.movie.getIdentifier ? self.movie.getIdentifier() : self.get('imdb');

		self.button = new Element('a.imdb', {
			'text': 'IMDB',
			'title': 'Go to the IMDB page of ' + self.getTitle(),
			'href': 'http://www.imdb.com/title/'+self.id+'/',
			'target': '_blank'
		});

		if(!self.id) self.disable();
	}

});

MA.Release = new Class({

	Extends: MovieAction,
	label: 'Releases',

	create: function(){
		var self = this;

		App.on('movie.searcher.ended', function(notification){
			if(self.movie.data._id != notification.data._id) return;

			self.releases = null;
			if(self.options_container){
				// Releases are currently displayed
				if(self.options_container.isDisplayed()){
					self.options_container.destroy();
					self.getDetails();
				}
				else {
					self.options_container.destroy();
					self.options_container = null;
				}
			}
		});

	},

	getDetails: function(refresh){
		var self = this;
		if(self.movie.data.releases.length === 0) return;

		if(!self.options_container || refresh){
			self.options_container = new Element('div.options').grab(
				self.release_container = new Element('div.releases.table')
			);

			// Header
			new Element('div.item.head').adopt(
				new Element('span.name', {'text': 'Release name'}),
				new Element('span.status', {'text': 'Status'}),
				new Element('span.quality', {'text': 'Quality'}),
				new Element('span.size', {'text': 'Size'}),
				new Element('span.age', {'text': 'Age'}),
				new Element('span.score', {'text': 'Score'}),
				new Element('span.provider', {'text': 'Provider'}),
				new Element('span.actions')
			).inject(self.release_container);

			if(self.movie.data.releases)
				self.movie.data.releases.each(function(release){

					var quality = Quality.getQuality(release.quality) || {},
						info = release.info || {},
						provider = self.get(release, 'provider') + (info.provider_extra ? self.get(release, 'provider_extra') : '');

					var release_name = self.get(release, 'name');
					if(release.files && release.files.length > 0){
						try {
							var movie_file = release.files.filter(function(file){
								var type = File.Type.get(file.type_id);
								return type && type.identifier == 'movie';
							}).pick();
							release_name = movie_file.path.split(Api.getOption('path_sep')).getLast();
						}
						catch(e){}
					}

					// Create release
					release.el = new Element('div', {
						'class': 'item '+release.status,
						'id': 'release_'+release._id
					}).adopt(
						new Element('span.name', {'text': release_name, 'title': release_name}),
						new Element('span.status', {'text': release.status, 'class': 'status '+release.status}),
						new Element('span.quality', {'text': quality.label + (release.is_3d ? ' 3D' : '') || 'n/a'}),
						new Element('span.size', {'text': info.size ? Math.floor(self.get(release, 'size')) : 'n/a'}),
						new Element('span.age', {'text': self.get(release, 'age')}),
						new Element('span.score', {'text': self.get(release, 'score')}),
						new Element('span.provider', { 'text': provider, 'title': provider }),
						new Element('span.actions').adopt(
							info.detail_url ? new Element('a.icon-info', {
								'href': info.detail_url,
								'target': '_blank'
							}) : new Element('a'),
							new Element('a.icon-download', {
								'events': {
									'click': function(e){
										(e).preventDefault();
										if(!this.hasClass('completed'))
											self.download(release);
									}
								}
							}),
							new Element('a', {
								'class': release.status == 'ignored' ? 'icon-redo' : 'icon-cancel',
								'events': {
									'click': function(e){
										(e).preventDefault();
										self.ignore(release);

										this.toggleClass('icon-redo');
										this.toggleClass('icon-cancel');
									}
								}
							})
						)
					).inject(self.release_container);

					if(release.status == 'ignored' || release.status == 'failed' || release.status == 'snatched'){
						if(!self.last_release || (self.last_release && self.last_release.status != 'snatched' && release.status == 'snatched'))
							self.last_release = release;
					}
					else if(!self.next_release && release.status == 'available'){
						self.next_release = release;
					}

					var update_handle = function(notification) {
						if(notification.data._id != release._id) return;

						var q = self.movie.quality.getElement('.q_' + release.quality),
							new_status = notification.data.status;

						release.el.set('class', 'item ' + new_status);

						release.el.getElement(':last-child')
							.set('class', notification.data.status == 'ignored' ? 'icon-redo' : 'icon-cancel');

						var status_el = release.el.getElement('.status');
							status_el.set('class', 'status ' + new_status);
							status_el.set('text', new_status);

						if(!q && (new_status == 'snatched' || new_status == 'seeding' || new_status == 'done'))
							q = self.addQuality(release.quality_id);

						if(q && !q.hasClass(new_status)) {
							q.removeClass(release.status).addClass(new_status);
							q.set('title', q.get('title').replace(release.status, new_status));
						}
					};

					App.on('release.update_status', update_handle);

				});

			if(self.last_release)
				self.release_container.getElements('#release_'+self.last_release._id).addClass('last_release');

			if(self.next_release)
				self.release_container.getElements('#release_'+self.next_release._id).addClass('next_release');

			if(self.next_release || (self.last_release && ['ignored', 'failed'].indexOf(self.last_release.status) === false)){

				self.trynext_container = new Element('div.buttons.try_container').inject(self.release_container, 'top');

				var nr = self.next_release,
					lr = self.last_release;

				self.trynext_container.adopt(
					new Element('span.or', {
						'text': 'If anything went wrong, download'
					}),
					lr ? new Element('a.button.orange', {
						'text': 'the same release again',
						'events': {
							'click': function(){
								self.download(lr);
							}
						}
					}) : null,
					nr && lr ? new Element('span.or', {
						'text': ','
					}) : null,
					nr ? [new Element('a.button.green', {
						'text': lr ? 'another release' : 'the best release',
						'events': {
							'click': function(){
								self.download(nr);
							}
						}
					}),
					new Element('span.or', {
						'text': 'or pick one below'
					})] : null
				);
			}

			self.last_release = null;
			self.next_release = null;

		}

		return self.options_container;

	},

	showHelper: function(e){
		var self = this;
		if(e)
			(e).preventDefault();

		var has_available = false,
			has_snatched = false;

		if(self.movie.data.releases)
			self.movie.data.releases.each(function(release){
				if(has_available && has_snatched) return;

				if(['snatched', 'downloaded', 'seeding', 'done'].contains(release.status))
					has_snatched = true;

				if(['available'].contains(release.status))
					has_available = true;

			});

		if(has_available || has_snatched){

			self.trynext_container = new Element('div.buttons.trynext').inject(self.movie.info_container);

			self.trynext_container.adopt(
				has_available ? [new Element('a.icon-redo', {
					'text': has_snatched ? 'Download another release' : 'Download the best release',
					'events': {
						'click': self.tryNextRelease.bind(self)
					}
				}),
				new Element('a.icon-download', {
					'text': 'pick one yourself',
					'events': {
						'click': function(){
							self.movie.quality.fireEvent('click');
						}
					}
				})] : null,
				new Element('a.icon-ok', {
					'text': 'mark this movie done',
					'events': {
						'click': self.markMovieDone.bind(self)
					}
				})
			);
		}

	},

	get: function(release, type){
		return (release.info && release.info[type] !== undefined) ? release.info[type] : 'n/a';
	},

	download: function(release){
		var self = this;

		var release_el = self.release_container.getElement('#release_'+release._id),
			icon = release_el.getElement('.icon-download');

		if(icon)
			icon.addClass('icon spinner').removeClass('download');

		Api.request('release.manual_download', {
			'data': {
				'id': release._id
			},
			'onComplete': function(json){
				if(icon)
					icon.removeClass('icon spinner');

				if(json.success){
					if(icon)
						icon.addClass('completed');
					release_el.getElement('.release_status').set('text', 'snatched');
				}
				else
					if(icon)
						icon.addClass('attention').set('title', 'Something went wrong when downloading, please check logs.');
			}
		});
	},

	ignore: function(release){

		Api.request('release.ignore', {
			'data': {
				'id': release._id
			}
		});

	},

	markMovieDone: function(){
		var self = this;

		Api.request('media.delete', {
			'data': {
				'id': self.movie.get('_id'),
				'delete_from': 'wanted'
			},
			'onComplete': function(){
				var movie = $(self.movie);
				movie.set('tween', {
					'duration': 300,
					'onComplete': function(){
						self.movie.destroy();
					}
				});
				movie.tween('height', 0);
			}
		});

	},

	tryNextRelease: function(){
		var self = this;

		Api.request('movie.searcher.try_next', {
			'data': {
				'media_id': self.movie.get('_id')
			}
		});

	}

});

MA.Trailer = new Class({

	Extends: MovieAction,
	id: null,
	label: 'Trailer',

	getDetails: function(){
		var self = this;

		if(!self.player_container){
			var id = 'trailer-'+randomString();
			self.player_container = new Element('div.icon-play[id='+id+']', {
				'events': {
					'click': function(e){
						self.watch(id);
					}
				}
			});
			self.container = new Element('div.trailer_container')
				.grab(self.player_container);
		}

		var data_url = 'https://www.googleapis.com/youtube/v3/search?q="{title}" {year} trailer&maxResults=1&type=video&videoDefinition=high&videoEmbeddable=true&part=snippet&key=AIzaSyAT3li1KjfLidaL6Vt8T92MRU7n4VOrjYk';
		var url = data_url.substitute({
				'title': encodeURI(self.getTitle()),
				'year': self.get('year')
			});

		new Request.JSONP({
			'url': url,
			'onComplete': function(json){

				self.player = new YT.Player(id, {
					'height': '100%',
					'width': '100%',
					'videoId': json.items[0].id.videoId,
					'playerVars': {
						'showsearch': 0,
						'showinfo': 0,
						'wmode': 'transparent',
						'iv_load_policy': 3
					}
				});

			}
		}).send();

		return self.container;

	},

	stop: function(){
		var self = this;

		self.player.stopVideo();
		self.container.addClass('hide');
		self.close_button.addClass('hide');
		$(self.movie).setStyle('height', null);

		setTimeout(function(){
			self.container.destroy();
			self.close_button.destroy();
		}, 1800);
	}


});

MA.Category = new Class({

	Extends: MovieAction,

	create: function(){
		var self = this;

		var category = self.movie.get('category');

		self.detail_button = new BlockMenu(self, {
			'class': 'category',
			'button_text': category ? category.label : 'No category',
			'button_class': 'icon-dropdown'
		});

		var categories = CategoryList.getAll();
		if(categories.length > 0){

			$(self.detail_button).addEvents({
				'click:relay(li a)': function(e, el){
					(e).stopPropagation();

					// Update category
					Api.request('movie.edit', {
						'data': {
							'id': self.movie.get('_id'),
							'category_id': el.get('data-id')
						}
					});

					$(self.detail_button).getElements('.icon-ok').removeClass('icon-ok');
					el.addClass('icon-ok');

					self.detail_button.button.set('text', el.get('text'));

				}
			});

			self.detail_button.addLink(new Element('a[text=No category]', {
				'class': !category ? 'icon-ok' : '',
				'data-id': ''
			}));
			categories.each(function(c){
				self.detail_button.addLink(new Element('a', {
					'text': c.get('label'),
					'class': category && category._id == c.get('_id') ? 'icon-ok' : '',
					'data-id': c.get('_id')
				}));
			});
		}
		else {
			$(self.detail_button).hide();
		}

	}

});


MA.Profile = new Class({

	Extends: MovieAction,

	create: function(){
		var self = this;

		var profile = self.movie.profile;

		self.detail_button = new BlockMenu(self, {
			'class': 'profile',
			'button_text': profile ? profile.get('label') : 'No profile',
			'button_class': 'icon-dropdown'
		});

		var profiles = Quality.getActiveProfiles();
		if(profiles.length > 0){

			$(self.detail_button).addEvents({
				'click:relay(li a)': function(e, el){
					(e).stopPropagation();

					// Update category
					Api.request('movie.edit', {
						'data': {
							'id': self.movie.get('_id'),
							'profile_id': el.get('data-id')
						}
					});

					$(self.detail_button).getElements('.icon-ok').removeClass('icon-ok');
					el.addClass('icon-ok');

					self.detail_button.button.set('text', el.get('text'));

				}
			});

			profiles.each(function(pr){
				self.detail_button.addLink(new Element('a', {
					'text': pr.get('label'),
					'class': profile && profile.get('_id') == pr.get('_id') ? 'icon-ok' : '',
					'data-id': pr.get('_id')
				}));
			});
		}
		else {
			$(self.detail_button).hide();
		}

	}

});

MA.Edit = new Class({

	Extends: MovieAction,

	create: function(){
		var self = this;

		self.button = new Element('a.edit', {
			'text': 'Edit',
			'title': 'Change movie information, like title and quality.',
			'events': {
				'click': self.editMovie.bind(self)
			}
		});

	},

	editMovie: function(e){
		var self = this;
		(e).preventDefault();

		if(!self.options_container){
			self.options_container = new Element('div.options').adopt(
				new Element('div.form').adopt(
					self.title_select = new Element('select', {
						'name': 'title'
					}),
					self.profile_select = new Element('select', {
						'name': 'profile'
					}),
					self.category_select = new Element('select', {
						'name': 'category'
					}).grab(
						new Element('option', {'value': -1, 'text': 'None'})
					),
					new Element('a.button.edit', {
						'text': 'Save & Search',
						'events': {
							'click': self.save.bind(self)
						}
					})
				)
			).inject(self.movie, 'top');

			Array.each(self.movie.data.info.titles, function(title){
				new Element('option', {
					'text': title
				}).inject(self.title_select);

				if(title == self.movie.data.title)
					self.title_select.set('value', title);
			});


			// Fill categories
			var categories = CategoryList.getAll();

			if(categories.length === 0)
				self.category_select.hide();
			else {
				self.category_select.show();
				categories.each(function(category){

					var category_id = category.data._id;

					new Element('option', {
						'value': category_id,
						'text': category.data.label
					}).inject(self.category_select);

					if(self.movie.category && self.movie.category.data && self.movie.category.data._id == category_id)
						self.category_select.set('value', category_id);

				});
			}

			// Fill profiles
			var profiles = Quality.getActiveProfiles();
			if(profiles.length == 1)
				self.profile_select.hide();

			profiles.each(function(profile){

				var profile_id = profile.get('_id');

				new Element('option', {
					'value': profile_id,
					'text': profile.label ? profile.label : profile.data.label
				}).inject(self.profile_select);

				if(self.movie.get('profile_id') == profile_id)
					self.profile_select.set('value', profile_id);

			});

		}

		self.movie.slide('in', self.options_container);
	},

	save: function(e){
		(e).preventDefault();
		var self = this;

		Api.request('movie.edit', {
			'data': {
				'id': self.movie.get('_id'),
				'default_title': self.title_select.get('value'),
				'profile_id': self.profile_select.get('value'),
				'category_id': self.category_select.get('value')
			},
			'useSpinner': true,
			'spinnerTarget': $(self.movie),
			'onComplete': function(){
				self.movie.quality.set('text', self.profile_select.getSelected()[0].get('text'));
				self.movie.title.set('text', self.title_select.getSelected()[0].get('text'));
			}
		});

		self.movie.slide('out');
	}

});

MA.Refresh = new Class({

	Extends: MovieAction,

	create: function(){
		var self = this;

		self.button = new Element('a.refresh', {
			'text': 'Refresh',
			'title': 'Refresh the movie info and do a forced search',
			'events': {
				'click': self.doRefresh.bind(self)
			}
		});

	},

	doRefresh: function(e){
		var self = this;
		(e).stop();

		Api.request('media.refresh', {
			'data': {
				'id': self.movie.get('_id')
			}
		});
	}

});

MA.Readd = new Class({

	Extends: MovieAction,

	create: function(){
		var self = this,
			movie_done = self.movie.data.status == 'done',
			snatched;

		if(self.movie.data.releases && !movie_done)
			snatched = self.movie.data.releases.filter(function(release){
				return release.status && (release.status == 'snatched' || release.status == 'seeding' || release.status == 'downloaded' || release.status == 'done');
			}).length;

		if(movie_done || snatched && snatched > 0)
			self.el = new Element('a.readd', {
				'title': 'Re-add the movie and mark all previous snatched/downloaded as ignored',
				'events': {
					'click': self.doReadd.bind(self)
				}
			});

	},

	doReadd: function(e){
		var self = this;
		(e).preventDefault();

		Api.request('movie.add', {
			'data': {
				'identifier': self.movie.getIdentifier(),
				'ignore_previous': 1
			}
		});
	}

});

MA.Delete = new Class({

	Extends: MovieAction,

	Implements: [Chain],

	create: function(){
		var self = this;

		self.el = new Element('a.delete', {
			'title': 'Remove the movie from this CP list',
			'events': {
				'click': self.showConfirm.bind(self)
			}
		});

	},

	showConfirm: function(e){
		var self = this;
		(e).preventDefault();

		if(!self.delete_container){
			self.delete_container = new Element('div.buttons.delete_container').adopt(
				new Element('a.cancel', {
					'text': 'Cancel',
					'events': {
						'click': self.hideConfirm.bind(self)
					}
				}),
				new Element('span.or', {
					'text': 'or'
				}),
				new Element('a.button.delete', {
					'text': 'Delete ' + self.movie.title.get('text'),
					'events': {
						'click': self.del.bind(self)
					}
				})
			).inject(self.movie, 'top');
		}

		self.movie.slide('in', self.delete_container);

	},

	hideConfirm: function(e){
		var self = this;
		(e).preventDefault();

		self.movie.removeView();
		self.movie.slide('out');
	},

	del: function(e){
		(e).preventDefault();
		var self = this;

		var movie = $(self.movie);

		self.chain(
			function(){
				self.callChain();
			},
			function(){
				Api.request('media.delete', {
					'data': {
						'id': self.movie.get('_id'),
						'delete_from': self.movie.list.options.identifier
					},
					'onComplete': function(){
						movie.set('tween', {
							'duration': 300,
							'onComplete': function(){
								self.movie.destroy();
							}
						});
						movie.tween('height', 0);
					}
				});
			}
		);

		self.callChain();

	}

});

MA.Files = new Class({

	Extends: MovieAction,

	create: function(){
		var self = this;

		if(self.movie.data.releases && self.movie.data.releases.length > 0)
			self.el = new Element('a.directory', {
				'title': 'Available files',
				'events': {
					'click': self.show.bind(self)
				}
			});

	},

	show: function(){
		var self = this;

		if(!self.options_container){
			self.options_container = new Element('div.options').adopt(
				self.files_container = new Element('div.files.table')
			).inject(self.movie, 'top');

			// Header
			new Element('div.item.head').adopt(
				new Element('span.name', {'text': 'File'}),
				new Element('span.type', {'text': 'Type'})
			).inject(self.files_container);

			if(self.movie.data.releases)
				Array.each(self.movie.data.releases, function(release){
					var rel = new Element('div.release').inject(self.files_container);

					Object.each(release.files, function(files, type){
						Array.each(files, function(file){
							new Element('div.file.item').adopt(
								new Element('span.name', {'text': file}),
								new Element('span.type', {'text': type})
							).inject(rel);
						});
					});
				});

		}

		self.movie.slide('in', self.options_container);
	}

});
