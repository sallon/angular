/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {BehaviorSubject} from 'rxjs/BehaviorSubject';

import {createUrlTree} from '../src/create_url_tree';
import {ActivatedRoute, ActivatedRouteSnapshot, advanceActivatedRoute} from '../src/router_state';
import {PRIMARY_OUTLET, Params} from '../src/shared';
import {DefaultUrlSerializer, UrlPathWithParams, UrlSegment, UrlTree} from '../src/url_tree';

describe('createUrlTree', () => {
  const serializer = new DefaultUrlSerializer();

  it('should navigate to the root', () => {
    const p = serializer.parse('/');
    const t = createRoot(p, ['/']);
    expect(serializer.serialize(t)).toEqual('/');
  });

  it('should error when navigating to the root segment with params', () => {
    const p = serializer.parse('/');
    expect(() => createRoot(p, ['/', {p: 11}]))
        .toThrowError(/Root segment cannot have matrix parameters/);
  });

  it('should support nested segments', () => {
    const p = serializer.parse('/a/b');
    const t = createRoot(p, ['/one', 11, 'two', 22]);
    expect(serializer.serialize(t)).toEqual('/one/11/two/22');
  });

  it('should stringify positional parameters', () => {
    const p = serializer.parse('/a/b');
    const t = createRoot(p, ['/one', 11]);
    const params = t.root.children[PRIMARY_OUTLET].pathsWithParams;
    expect(params[0].path).toEqual('one');
    expect(params[1].path).toEqual('11');
  });

  it('should preserve secondary segments', () => {
    const p = serializer.parse('/a/11/b(right:c)');
    const t = createRoot(p, ['/a', 11, 'd']);
    expect(serializer.serialize(t)).toEqual('/a/11/d(right:c)');
  });

  it('should support updating secondary segments', () => {
    const p = serializer.parse('/a(right:b)');
    const t = createRoot(p, [{outlets: {right: ['c', 11, 'd']}}]);
    expect(serializer.serialize(t)).toEqual('/a(right:c/11/d)');
  });

  it('should support updating secondary segments (nested case)', () => {
    const p = serializer.parse('/a/(b//right:c)');
    const t = createRoot(p, ['a', {outlets: {right: ['d', 11, 'e']}}]);
    expect(serializer.serialize(t)).toEqual('/a/(b//right:d/11/e)');
  });

  it('should support updating using a string', () => {
    const p = serializer.parse('/a(right:b)');
    const t = createRoot(p, [{outlets: {right: 'c/11/d'}}]);
    expect(serializer.serialize(t)).toEqual('/a(right:c/11/d)');
  });

  it('should support updating primary and secondary segments at once', () => {
    const p = serializer.parse('/a(right:b)');
    const t = createRoot(p, [{outlets: {'': 'y/z', right: 'c/11/d'}}]);
    expect(serializer.serialize(t)).toEqual('/y/z(right:c/11/d)');
  });

  it('should support removing primary segment', () => {
    const p = serializer.parse('/a/(b//right:c)');
    const t = createRoot(p, ['a', {outlets: {'': null, right: 'd'}}]);
    expect(serializer.serialize(t)).toEqual('/a/(right:d)');
  });

  it('should support removing secondary segments', () => {
    const p = serializer.parse('/a(right:b)');
    const t = createRoot(p, [{outlets: {right: null}}]);
    expect(serializer.serialize(t)).toEqual('/a');
  });

  it('should update matrix parameters', () => {
    const p = serializer.parse('/a;pp=11');
    const t = createRoot(p, ['/a', {pp: 22, dd: 33}]);
    expect(serializer.serialize(t)).toEqual('/a;pp=22;dd=33');
  });

  it('should create matrix parameters', () => {
    const p = serializer.parse('/a');
    const t = createRoot(p, ['/a', {pp: 22, dd: 33}]);
    expect(serializer.serialize(t)).toEqual('/a;pp=22;dd=33');
  });

  it('should create matrix parameters together with other segments', () => {
    const p = serializer.parse('/a');
    const t = createRoot(p, ['/a', '/b', {aa: 22, bb: 33}]);
    expect(serializer.serialize(t)).toEqual('/a/b;aa=22;bb=33');
  });

  describe('relative navigation', () => {
    it('should work', () => {
      const p = serializer.parse('/a/(c//left:cp)(left:ap)');
      const t = create(p.root.children[PRIMARY_OUTLET], 0, p, ['c2']);
      expect(serializer.serialize(t)).toEqual('/a/(c2//left:cp)(left:ap)');
    });

    it('should work when the first command starts with a ./', () => {
      const p = serializer.parse('/a/(c//left:cp)(left:ap)');
      const t = create(p.root.children[PRIMARY_OUTLET], 0, p, ['./c2']);
      expect(serializer.serialize(t)).toEqual('/a/(c2//left:cp)(left:ap)');
    });

    it('should work when the first command is ./)', () => {
      const p = serializer.parse('/a/(c//left:cp)(left:ap)');
      const t = create(p.root.children[PRIMARY_OUTLET], 0, p, ['./', 'c2']);
      expect(serializer.serialize(t)).toEqual('/a/(c2//left:cp)(left:ap)');
    });

    it('should work when given params', () => {
      const p = serializer.parse('/a/(c//left:cp)(left:ap)');
      const t = create(p.root.children[PRIMARY_OUTLET], 0, p, [{'x': 99}]);
      expect(serializer.serialize(t)).toEqual('/a/(c;x=99//left:cp)(left:ap)');
    });

    it('should work when index > 0', () => {
      const p = serializer.parse('/a/c');
      const t = create(p.root.children[PRIMARY_OUTLET], 1, p, ['c2']);
      expect(serializer.serialize(t)).toEqual('/a/c/c2');
    });

    it('should support going to a parent (within a segment)', () => {
      const p = serializer.parse('/a/c');
      const t = create(p.root.children[PRIMARY_OUTLET], 1, p, ['../c2']);
      expect(serializer.serialize(t)).toEqual('/a/c2');
    });

    it('should support setting matrix params', () => {
      const p = serializer.parse('/a/(c//left:cp)(left:ap)');
      const t = create(p.root.children[PRIMARY_OUTLET], 0, p, ['../', {x: 5}]);
      expect(serializer.serialize(t)).toEqual('/a;x=5(left:ap)');
    });

    xit('should support going to a parent (across segments)', () => {
      const p = serializer.parse('/q/(a/(c//left:cp)//left:qp)(left:ap)');

      const t =
          create(p.root.children[PRIMARY_OUTLET].children[PRIMARY_OUTLET], 0, p, ['../../q2']);
      expect(serializer.serialize(t)).toEqual('/q2(left:ap)');
    });

    it('should navigate to the root', () => {
      const p = serializer.parse('/a/c');
      const t = create(p.root.children[PRIMARY_OUTLET], 0, p, ['../']);
      expect(serializer.serialize(t)).toEqual('/');
    });

    it('should work with ../ when absolute url', () => {
      const p = serializer.parse('/a/c');
      const t = create(p.root.children[PRIMARY_OUTLET], 1, p, ['../', 'c2']);
      expect(serializer.serialize(t)).toEqual('/a/c2');
    });

    it('should work with position = -1', () => {
      const p = serializer.parse('/');
      const t = create(p.root, -1, p, ['11']);
      expect(serializer.serialize(t)).toEqual('/11');
    });

    it('should throw when too many ..', () => {
      const p = serializer.parse('/a/(c//left:cp)(left:ap)');
      expect(() => create(p.root.children[PRIMARY_OUTLET], 0, p, ['../../']))
          .toThrowError('Invalid number of \'../\'');
    });
  });

  it('should set query params', () => {
    const p = serializer.parse('/');
    const t = createRoot(p, [], {a: 'hey'});
    expect(t.queryParams).toEqual({a: 'hey'});
  });

  it('should stringify query params', () => {
    const p = serializer.parse('/');
    const t = createRoot(p, [], <any>{a: 1});
    expect(t.queryParams).toEqual({a: '1'});
  });

  it('should set fragment', () => {
    const p = serializer.parse('/');
    const t = createRoot(p, [], {}, 'fragment');
    expect(t.fragment).toEqual('fragment');
  });
});


function createRoot(tree: UrlTree, commands: any[], queryParams?: Params, fragment?: string) {
  const s = new ActivatedRouteSnapshot(
      [], <any>{}, <any>{}, PRIMARY_OUTLET, 'someComponent', null, tree.root, -1, <any>null);
  const a = new ActivatedRoute(
      new BehaviorSubject(null), new BehaviorSubject(null), new BehaviorSubject(null),
      PRIMARY_OUTLET, 'someComponent', s);
  advanceActivatedRoute(a);
  return createUrlTree(a, tree, commands, queryParams, fragment);
}

function create(
    segment: UrlSegment, startIndex: number, tree: UrlTree, commands: any[], queryParams?: Params,
    fragment?: string) {
  if (!segment) {
    expect(segment).toBeDefined();
  }
  const s = new ActivatedRouteSnapshot(
      [], <any>{}, <any>{}, PRIMARY_OUTLET, 'someComponent', null, <any>segment, startIndex,
      <any>null);
  const a = new ActivatedRoute(
      new BehaviorSubject(null), new BehaviorSubject(null), new BehaviorSubject(null),
      PRIMARY_OUTLET, 'someComponent', s);
  advanceActivatedRoute(a);
  return createUrlTree(a, tree, commands, queryParams, fragment);
}