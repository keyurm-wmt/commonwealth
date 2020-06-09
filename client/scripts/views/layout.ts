import 'layout.scss';

import m from 'mithril';
import $ from 'jquery';
import { EmptyState, Icons } from 'construct-ui';

import { initChain, initCommunity, deinitChainOrCommunity } from 'app';
import app from 'state';
import { notifyError } from 'controllers/app/notifications';
import Header from 'views/components/header';
import PageNotFound from 'views/pages/404';
import { AppModals } from 'views/modal';
import AppToasts from 'views/toast';
import { featherIcon } from 'helpers';

const CHAIN_LOADING_TIMEOUT = 3000;

export const LoadingLayout: m.Component<{ activeTag: string, wideLayout: boolean }> = {
  view: (vnode) => {
    const { activeTag, wideLayout } = vnode.attrs;

    return m('.Layout.LoadingLayout.mithril-app', [
      m(Header),
      m('.layout-container', [
        m('.LoadingLayout'),
      ]),
      m(AppModals),
      m(AppToasts),
    ]);
  }
};

export const Layout: m.Component<{ scope: string, activeTag?: string, wideLayout?: boolean }, { loadingScope }> = {
  view: (vnode) => {
    const { scope, activeTag, wideLayout } = vnode.attrs;
    const scopeMatchesChain = app.config.nodes.getAll().find((n) => n.chain.id === scope);
    const scopeMatchesCommunity = app.config.communities.getAll().find((c) => c.id === scope);

    if (app.loadingError) {
      return m('.Layout.mithril-app', [
        m(Header),
        m('.layout-container', [
          m(EmptyState, {
            fill: true,
            icon: Icons.X,
            content: [
              m('p', `Application error: ${app.loadingError}`),
              m('p', 'Please try again at another time'),
            ],
            style: 'color: #546e7b;'
          }),
        ]),
        m(AppModals),
        m(AppToasts),
      ]);
    } else if (!app.loginStatusLoaded()) {
      // Wait for /api/status to return with the user's login status
      return m(LoadingLayout, { activeTag, wideLayout });
    } else if (scope && !scopeMatchesChain && !scopeMatchesCommunity) {
      // If /api/status has returned, then app.config.nodes and app.config.communities
      // should both be loaded. If we match neither of them, then we can safely 404
      return m('.Layout.mithril-app', [
        m(Header),
        m('.layout-container', [
          m(PageNotFound)
        ]),
        m(AppModals),
        m(AppToasts),
      ]);
    } else if (scope && scope !== app.activeId() && scope !== vnode.state.loadingScope) {
      // If we are supposed to load a new chain or community, we do so now
      // This happens only once, and then loadingScope should be set
      vnode.state.loadingScope = scope;
      if (scopeMatchesChain) {
        initChain(scope);
        return m(LoadingLayout, { activeTag, wideLayout });
      } else if (scopeMatchesCommunity) {
        initCommunity(scope);
        return m(LoadingLayout, { activeTag, wideLayout });
      }
    } else if (!scope && ((app.chain && app.chain.class) || app.community)) {
      // Handle the case where we unload the chain or community, if we're
      // going to a page that doesn't have one
      deinitChainOrCommunity().then(() => {
        vnode.state.loadingScope = null;
        m.redraw();
      });
      return m(LoadingLayout, { activeTag, wideLayout });
    }

    return m('.Layout.mithril-app', [
      m(Header),
      m('.layout-container', [
        vnode.children
      ]),
      m(AppModals),
      m(AppToasts),
    ]);
  }
};
