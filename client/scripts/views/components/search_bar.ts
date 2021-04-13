import 'pages/search.scss';

import m from 'mithril';
import _, { capitalize } from 'lodash';
import { ControlGroup, Input, List, ListItem } from 'construct-ui';
import {
  searchMentionableAddresses,
  searchDiscussions,
  searchChainsAndCommunities,
  CommunityIcon,
  DiscussionIcon,
  MemberIcon,
} from 'helpers/search';
import getTokenLists from 'views/pages/home/token_lists';
import app from 'state';
import { notifyError } from 'controllers/app/notifications';
import { Profile, AddressInfo } from 'models';
import moment from 'moment';
import MarkdownFormattedText from './markdown_formatted_text';
import QuillFormattedText from './quill_formatted_text';
import { CommunityLabel } from './sidebar/community_selector';
import User from './widgets/user';

interface SearchParams {
  communityScope?: string;
  isSearchPreview?: string;
}

export enum SearchType {
  Discussion = 'discussion',
  Community = 'community',
  Member = 'member',
  Top = 'top',
}

export enum ContentType {
  Thread = 'thread',
  Comment = 'comment',
  Community = 'community',
  Chain = 'chain',
  Token = 'token',
  Member = 'member'
}

const SEARCH_PREVIEW_SIZE = 5;
const SEARCH_PAGE_SIZE = 50; // must be same as SQL limit specified in the database query

// TODO: Linkification of users, tokens, comms results
export const getMemberPreview = (addr, searchTerm) => {
  const profile: Profile = app.profiles.getProfile(addr.chain, addr.address);
  const userLink = `/${m.route.param('scope') || addr.chain}/account/${addr.address}?base=${addr.chain}`;
  // TODO: Display longer or even full addresses
  return m(ListItem, {
    label: m('a.search-results-item', [
      // TODO: Add searchTerm support that's present in UserBlock
      m(User, {
        user: profile,
        // searchTerm,
        avatarSize: 17,
        showAddressWithDisplayName: true,
      }),
    ]),
    onclick: (e) => {
      m.route.set(userLink);
    }
  });
};

export const getCommunityPreview = (community) => {
  if (community.contentType === ContentType.Token) {
    return m(ListItem, {
      label: m('a.search-results-item', [
        m('img', {
          src: community.logoURI,
          height: '36px',
          width: '36px'
        }),
        m('span', community.name)
      ]),
      onclick: (e) => {
        // TODO: Linkification of tokens
        m.route.set('/');
      }
    });
  } else if (community.contentType === ContentType.Chain
    || community.contentType === ContentType.Community) {
    return m(ListItem, {
      label: m('a.search-results-item', [
        m(CommunityLabel, {
          community,
          size: 36,
        })
      ]),
      onclick: (e) => {
        m.route.set(community.id ? `/${community.id}` : '/');
      }
    });
  }
};

export const getDiscussionPreview = (thread, searchTerm) => {
  // TODO: Separate threads, proposals, and comments
  const activeId = app.activeId();
  const proposalId = thread.proposalid;
  return m(ListItem, {
    onclick: (e) => {
      m.route.set((thread.type === 'thread')
        ? `/${activeId}/proposal/discussion/${proposalId}`
        : `/${activeId}/proposal/${proposalId.split('_')[0]}/${proposalId.split('_')[1]}`);
    },
    label: m('a.search-results-item', [
      thread.type === 'thread' ? [
        m('.search-results-thread-title', [
          decodeURIComponent(thread.title),
        ]),
        m('.search-results-thread-body', [
          (() => {
            try {
              const doc = JSON.parse(decodeURIComponent(thread.body));
              if (!doc.ops) throw new Error();
              return m(QuillFormattedText, {
                doc,
                hideFormatting: true,
                collapse: true,
                searchTerm,
              });
            } catch (e) {
              const doc = decodeURIComponent(thread.body);
              return m(MarkdownFormattedText, {
                doc,
                hideFormatting: true,
                collapse: true,
                searchTerm,
              });
            }
          })(),
        ])
      ] : [
        m('.search-results-thread-title', [
          'Comment on ',
          decodeURIComponent(thread.title),
        ]),
        m('.search-results-thread-subtitle', [
          m('span.created-at', moment(thread.created_at).fromNow()),
          m(User, { user: new AddressInfo(thread.address_id, thread.address, thread.address_chain, null) }),
        ]),
        m('.search-results-comment', [
          (() => {
            try {
              const doc = JSON.parse(decodeURIComponent(thread.body));
              if (!doc.ops) throw new Error();
              return m(QuillFormattedText, {
                doc,
                hideFormatting: true,
                collapse: true,
                searchTerm,
              });
            } catch (e) {
              const doc = decodeURIComponent(thread.body);
              return m(MarkdownFormattedText, {
                doc,
                hideFormatting: true,
                collapse: true,
                searchTerm,
              });
            }
          })(),
        ]),
      ]
    ]),
  });
};

const sortResults = (a, b) => {
  // TODO: Token-sorting approach
  // Some users are not verified; we give them a default date of 1900
  const aCreatedAt = moment(a.created_at || a.createdAt || a.verified || '1900-01-01T:00:00:00Z');
  const bCreatedAt = moment(b.created_at || b.createdAt || b.verified || '1900-01-01T:00:00:00Z');
  return bCreatedAt.diff(aCreatedAt);
};

const getBalancedContentListing = (unfilteredResults: any[], types: SearchType[]) => {
  debugger
  const results = {};
  for (const key of types) {
    results[key] = [];
  }
  let priorityPosition = 0;
  let resultsLength = 0;
  while (resultsLength < 6) {
    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      if (resultsLength < 6) {
        const nextResult = unfilteredResults[type][priorityPosition];
        if (nextResult) {
          results[type].push(nextResult);
          resultsLength += 1;
        }
      }
    }
    priorityPosition += 1;
  }
  return results;
};

const getResultsPreview = (searchTerm: string, params: SearchParams, vnode, communityScoped?) => {
  let results;
  let types;
  if (communityScoped) {
    types = [SearchType.Discussion, SearchType.Member];
    results = getBalancedContentListing(app.searchCache, types);
  } else {
    types = [SearchType.Discussion, SearchType.Member, SearchType.Community];
    results = getBalancedContentListing(app.searchCache, types);
  }
  const organizedResults = [];
  types.forEach((type) => {
    debugger
    const res = results[type];
    if (res?.length === 0) return;
    const headerEle = m(ListItem, {
      label: `${capitalize(type)}s`,
      class: 'disabled',
      onclick: (e) => {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    organizedResults.push(headerEle);
    (res as any[]).forEach((item) => {
      const resultRow = item.searchType === SearchType.Discussion
        ? getDiscussionPreview(item, searchTerm)
        : item.searchType === SearchType.Member
          ? getMemberPreview(item, searchTerm)
          : item.searchType === SearchType.Community
            ? getCommunityPreview(item)
            : null;
      organizedResults.push(resultRow);
    });
  });
  return organizedResults;
};

const concludeSearch = (searchTerm: string, params: SearchParams, vnode, err?) => {
  console.log('loading over');
  app.searchCache.loaded = true;
  vnode.state.searchLoading = false;
  vnode.state.errorText = !err
    ? null : (err.responseJSON?.error || err.responseText || err.toString());
  vnode.state.results = getResultsPreview(searchTerm, params, vnode, true);
  m.redraw();
};

export const search = async (searchTerm: string, params: SearchParams, vnode) => {
  vnode.state.searchLoading = true;
  console.log({ searchTerm });
  // TODO: Hookup community and member scope
  const { communityScope, isSearchPreview } = params;
  const querySize = isSearchPreview ? SEARCH_PREVIEW_SIZE : SEARCH_PAGE_SIZE;

  // if !communityScope search only...

  try {
    const discussions = await searchDiscussions(searchTerm, querySize);
    console.log({ discussions });
    app.searchCache[SearchType.Discussion] = discussions.map((discussion) => {
      discussion.contentType = discussion.root_id ? ContentType.Comment : ContentType.Thread;
      discussion.searchType = SearchType.Discussion;
      return discussion;
    }).sort(sortResults);

    const addrs = await searchMentionableAddresses(searchTerm, querySize, ['created_at', 'DESC']);
    console.log({ addrs });
    app.searchCache[SearchType.Member] = addrs.map((addr) => {
      addr.contentType = ContentType.Member;
      addr.searchType = SearchType.Member;
      return addr;
    }).sort(sortResults);
    m.redraw();

    if (communityScope) {
      concludeSearch(searchTerm, params, vnode);
      return;
    }

    const unfilteredTokens = await getTokenLists();
    const tokens = unfilteredTokens.filter((token) => token.name?.toLowerCase().includes(searchTerm));
    console.log({ tokens });
    app.searchCache[SearchType.Community] = tokens.map((token) => {
      token.contentType = ContentType.Token;
      token.searchType = SearchType.Community;
      return token;
    });

    const comms = await searchChainsAndCommunities(searchTerm, querySize);
    console.log(comms);
    app.searchCache[SearchType.Community] = app.searchCache[SearchType.Community]
      .concat(comms.map((commOrChain) => {
        commOrChain.contentType = commOrChain.created_at ? ContentType.Community : ContentType.Chain;
        commOrChain.searchType = SearchType.Community;
        return commOrChain;
      })).sort(sortResults);

    concludeSearch(searchTerm, params, vnode);
  } catch (err) {
    concludeSearch(searchTerm, params, vnode, err);
  }
};

const SearchBar : m.Component<{}, {
  results: any[],
  searchLoading: boolean,
  searchTerm: string,
  searchModified: boolean,
  errorText: string,
  focused: boolean,
}> = {
  view: (vnode) => {
    const inCommunity = app.chain || app.community;
    if (!vnode.state.searchTerm) vnode.state.searchTerm = '';

    const { results, searchTerm } = vnode.state;

    return m(ControlGroup, {
      class: vnode.state.focused ? 'SearchBar focused' : 'SearchBar'
    }, [
      m(Input, {
        placeholder: 'Type to search...',
        autofocus: true,
        fluid: true,
        defaultValue: m.route.param('q') || vnode.state.searchTerm,
        value: vnode.state.searchTerm,
        oncreate: (e) => {
          if ((e.dom?.children[0] as HTMLInputElement)?.value) {
            vnode.state.searchTerm = (e.dom.children[0] as HTMLInputElement).value.toLowerCase();
          }
        },
        onclick: async (e) => {
          vnode.state.focused = true;
        },
        // contentLeft,
        oninput: async (e) => {
          if (!vnode.state.searchModified) {
            vnode.state.searchModified = true;
          }
          vnode.state.searchTerm = e.target.value?.toLowerCase();
          if (e.target.value?.length >= 3) {
            const params = inCommunity ? { communityScope: inCommunity.id } : {};
            await search(vnode.state.searchTerm, params, vnode);
          }
        },
        onkeyup: (e) => {
          if (e.key === 'Enter') {
            if (!searchTerm || !searchTerm.toString().trim() || !searchTerm.match(/[A-Za-z]+/)) {
              notifyError('Enter a valid search term');
              return;
            }
            if (searchTerm.length < 3) {
              notifyError('Query must be at least 3 characters');
            }
            // TODO: Consistent, in-advance sanitization of all params
            let params = `q=${encodeURIComponent(vnode.state.searchTerm.toString().trim())}`;
            if (inCommunity) params += `&in=${inCommunity.id}`;
            vnode.state.searchModified = false;
            m.route.set(`/${app.activeId()}/search?q=${params}}`);
          }
        },
      }),
      // TODO: Addrs are showing twice
      (results?.length > 0)
      && m(List, results)
    ]);
  }
};

export default SearchBar;
