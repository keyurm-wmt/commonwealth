import $ from 'jquery';
import m from 'mithril';
import { Button, Table } from 'construct-ui';

import { ChainNetwork } from 'models';
import { notifyError } from 'controllers/app/notifications';
import { IChainOrCommMetadataManagementAttrs } from './community_metadata_management_table';
import { InputPropertyRow, ManageRolesRow } from './metadata_rows';

interface IChainMetadataManagementState {
  name: string;
  description: string;
  website: string;
  discord: string;
  element: string;
  telegram: string;
  github: string;
  url: string;
  loadingFinished: boolean;
  loadingStarted: boolean;
  iconUrl: string;
  customDomain: string;
  network: ChainNetwork;
  symbol: string;
}

const ChainMetadataManagementTable: m.Component<IChainOrCommMetadataManagementAttrs, IChainMetadataManagementState> = {
  oninit: (vnode) => {
    vnode.state.name = vnode.attrs.chain.name;
    vnode.state.description = vnode.attrs.chain.description;
    vnode.state.website = vnode.attrs.chain.website;
    vnode.state.discord = vnode.attrs.chain.discord;
    vnode.state.element = vnode.attrs.chain.element;
    vnode.state.telegram = vnode.attrs.chain.telegram;
    vnode.state.github = vnode.attrs.chain.github;
    vnode.state.customDomain = vnode.attrs.chain.customDomain;
    vnode.state.iconUrl = vnode.attrs.chain.iconUrl;
    vnode.state.network = vnode.attrs.chain.network;
    vnode.state.symbol = vnode.attrs.chain.symbol;
  },
  view: (vnode) => {
    return m('.ChainMetadataManagementTable', [
      m(Table, {
        bordered: false,
        interactive: false,
        striped: false,
        class: 'metadata-management-table',
      }, [
        m(InputPropertyRow, {
          title: 'Name',
          defaultValue: vnode.state.name,
          onChangeHandler: (v) => { vnode.state.name = v; },
        }),
        m(InputPropertyRow, {
          title: 'Description',
          defaultValue: vnode.state.description,
          onChangeHandler: (v) => { vnode.state.description = v; },
          textarea: true,
        }),
        m(InputPropertyRow, {
          title: 'Website',
          defaultValue: vnode.state.website,
          placeholder: 'https://example.com',
          onChangeHandler: (v) => { vnode.state.website = v; },
        }),
        m(InputPropertyRow, {
          title: 'Discord',
          defaultValue: vnode.state.discord,
          placeholder: 'https://discord.com/invite',
          onChangeHandler: (v) => { vnode.state.discord = v; },
        }),
        m(InputPropertyRow, {
          title: 'Element',
          defaultValue: vnode.state.element,
          placeholder: 'https://matrix.to/#',
          onChangeHandler: (v) => { vnode.state.element = v; },
        }),
        m(InputPropertyRow, {
          title: 'Telegram',
          defaultValue: vnode.state.telegram,
          placeholder: 'https://t.me',
          onChangeHandler: (v) => { vnode.state.telegram = v; },
        }),
        m(InputPropertyRow, {
          title: 'Github',
          defaultValue: vnode.state.github,
          placeholder: 'https://github.com',
          onChangeHandler: (v) => { vnode.state.github = v; },
        }),
        m(InputPropertyRow, {
          title: 'Domain',
          defaultValue: vnode.state.customDomain,
          placeholder: 'gov.edgewa.re',
          onChangeHandler: (v) => { vnode.state.customDomain = v; },
        }),
        m('tr', [
          m('td', 'Admins'),
          m('td', [ m(ManageRolesRow, {
            roledata: vnode.attrs.admins,
            onRoleUpdate: (x, y) => { vnode.attrs.onRoleUpdate(x, y); },
          }), ]),
        ]),
        vnode.attrs.mods.length > 0
          && m('tr', [
            m('td', 'Moderators'),
            m('td', [ m(ManageRolesRow, {
              roledata: vnode.attrs.mods,
              onRoleUpdate: (x, y) => { vnode.attrs.onRoleUpdate(x, y); },
            }), ])
          ]),
      ]),
      m(Button, {
        class: 'save-changes-button',
        label: 'Save changes',
        intent: 'primary',
        onclick: async (e) => {
          const { name, description, website, discord, element, telegram, github, customDomain } = vnode.state;
          try {
            await vnode.attrs.chain.updateChainData(name, description, website, discord, element, telegram, github, customDomain);
            $(e.target).trigger('modalexit');
          } catch (err) {
            notifyError(err.responseJSON?.error || 'Chain update failed');
          }
        },
      }),
    ]);
  },
};

export default ChainMetadataManagementTable;
