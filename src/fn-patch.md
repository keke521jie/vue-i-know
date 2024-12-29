# patch 函数

**代码位置 core\packages\runtime-core\src\renderer.ts**

### patch 函数声明

```js
type PatchFn = (
  n1: VNode | null, // 旧的虚拟节点，如果为null则表示挂载
  n2: VNode, // 新的虚拟节点
  container: RendererElement, // 真实dom容器用于更新挂载
  anchor?: RendererNode | null, // 锚点，用于确认插入位置
  parentComponent?: ComponentInternalInstance | null, // 父组件实例
  parentSuspense?: SuspenseBoundary | null, // 父组件边界
  namespace?: ElementNamespace, // 命名空间
  slotScopeIds?: string[] | null, // 作用域插槽id列表
  optimized?: boolean // 优化标志
) => void;
```

### patch 过程

1. 判断新旧节点是否是同一节点，同一个节点则不进行处理
2. 判断标签类型是否一致，不一致则卸载掉 old tree
3. 判断新的虚拟节点时候可优化，标志结果并且设置动态结点列表
4. 根据节点类型处理节点

   ```js
   // VNode的类型
   export type VNodeTypes =
     | string
     | VNode
     | Component
     | typeof Text
     | typeof Static
     | typeof Comment
     | typeof Fragment
     | typeof Teleport
     | typeof TeleportImpl
     | typeof Suspense
     | typeof SuspenseImpl;
   ```

   **处理过程 代码位置 core\packages\runtime-dom\src\nodeOps.ts**

   - Text 类型节点处理
     1. 首先判断旧虚拟节点是否存在，不存在则直接调用 insert 方法挂载新的节点，实际就是使用 el.insertBefore 将节点插入到指定位置。
     2. 旧节点存在则将旧的节点复用到新的节点，然后比较 children（这里是文字内容） 属性是否一致
     3. 一致不处理直接复用，不一致调用 setText 方法修改内容
   - Comment 注释节点（跟 Text 处理方式大致相同，不支持动态注释即没有步骤 23）
   - Static 静态类型节点处理

     1. 判断旧的虚拟节点是否为 null 为 null 直接挂载新的虚拟节点
     2. 判断是否只有一个根节点，或者下一个兄弟节点信息可用（是否可以采用缓存）

     ```js
     if (start && (start === end || start.nextSibling)) {
     // cached
     while (true) {
       parent.insertBefore(start!.cloneNode(true), anchor)
       if (start === end || !(start = start!.nextSibling)) break
     }
     } else {
      // 插入
     }
     ```

     3. 不为 null 则判断是否在开发环境（只有在开发环境处理不为 null 的情况）
     4. 判断 children 是否变化，有变化则循环删除掉旧的插入新的，没变化则将旧的信息更新为新的

   - Fragment 类型
     1. 定义片段的开始节点个结束节点（如果旧结点存在则使用旧结点信息定义否则创建俩个新的空文本节点）
     2. 判断是否在开发环境 开发环境强制完成 diff 清空优化标志和动态子节点信息
     3. 合并作用域插槽的 id 数组
     4. 判断是否为首次挂载，首次挂载受首先挂载锚点（开始，结束），调用 mountChildren 挂载片段的子节点
     5. 非首次挂载会判断是否为稳定片段如果是稳定片段则进行块更新（更新动态内容），更新时判断是否是开发环境，开发环境则进行深递归处理
     6. 不稳定则全量更新（调用 patchChildren 函数）
        **patchChildren 函数**
        函数会判断新节点 patchFlag 是否存在 KEYED_FRAGMENT （key 可以是混合存在的）分开处理
        没 key 的处理逻辑较为简单 Math.min 拿到新老结点的最小值循环处理每个结点 patch,如果新结点子节点长度大于旧结点子节点长度则挂载剩余结点，否则卸载多余结点
        有 key 或者混合结点的处理较为复杂（常说的 diff 算法）Vue3 diff 算法: **代码位置：core\packages\runtime-core\src\renderer.ts patchKeyedChildren 函数**
        ```js
        let i = 0;
        const l2 = c2.length;
        let e1 = c1.length - 1; // prev ending index
        let e2 = l2 - 1; // next ending index
        ```
        1. 从头开始同步 新旧虚拟结点从头开始对比判断 调用 isSameVNodeType 函数进行判断是否为相同节点，生产环境判断节点标签和 key 是否相等来判断俩节点是否为同一节点。开发环境会判断该节点是否为组件，并进行组件脏值检查判断组件是否被标记为脏（脏组件指的是再热模块替换中被标记为需要更新的组件）位运算清除活动组件标记，如果组件已经热更新，则强制重载。
        ```js
        export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
        if (__DEV__ && n2.shapeFlag & ShapeFlags.COMPONENT && n1.component) {
          const dirtyInstances = hmrDirtyComponents.get(n2.type as ConcreteComponent)
          if (dirtyInstances && dirtyInstances.has(n1.component)) {
            // #7042, ensure the vnode being unmounted during HMR
            // bitwise operations to remove keep alive flags
            n1.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
            n2.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE
            // HMR only: if the component has been hot-updated, force a reload.
            return false
          }
        }
        return n1.type === n2.type && n1.key === n2.key
        }
        ```
        2. 从尾部开始同步 与步骤 1 相似循环判断 调用 isSameVNodeType 函数
        3. 判断 **i > e1** 为真意味着就旧节点处理完了 判断**i <= e2** 是否有剩余的新节点然挂载剩余新增节点
        4. 判断 **i > e2** 为真意味着新的节点处理完了 判断**i <= e1** 是否有剩余的旧节点然后将其卸载
        5. 未知序列处理
           - 首先循环处理中间剩余未处理的新的剩余节点，完成一个索引图 是一个 Map 键是节点的 key 属性，值是节点所在的位置索引,在开发环境会判断 key 的唯一性，key 不唯一会提示警告
           - 先确认剩余要处理的新节点的数量根据数量构建一个状态数组，初始化为 0 表示该位置节点未处理过，然后存旧的未处理节点的第一个节点开始循环每次循环判断是否全部处理，全部处理则将剩余节点卸载。判断节点是否有 key 属性，在索引图中取出对应 key 的索引，如果不存在 key 则循环新的新的未处理节点查找有没有对应的节点与之匹配，拿到它的位置索引信息。然后判断位置是否存在，不存在证明该节点在新列表里不存在需要删除，直接调用 unmount 卸载该节点。否则更新状态数组标记该节点已经被处理，判断节点是否需要移动并更新 maxNewIndexSoFar 用于追踪最长递增子序列。
           ```js
           for (i = s1; i <= e1; i++) {
           const prevChild = c1[i]
           if (patched >= toBePatched) {
             // all new children have been patched so this can only be a removal
             unmount(prevChild, parentComponent, parentSuspense, true)
             continue
           }
           let newIndex
           if (prevChild.key != null) {
             newIndex = keyToNewIndexMap.get(prevChild.key)
           } else {
             // key-less node, try to locate a key-less node of the same type
             for (j = s2; j <= e2; j++) {
               if (
                 newIndexToOldIndexMap[j - s2] === 0 &&
                 isSameVNodeType(prevChild, c2[j] as VNode)
               ) {
                 newIndex = j
                 break
               }
             }
           }
           if (newIndex === undefined) {
             unmount(prevChild, parentComponent, parentSuspense, true)
           } else {
             newIndexToOldIndexMap[newIndex - s2] = i + 1
             if (newIndex >= maxNewIndexSoFar) {
               maxNewIndexSoFar = newIndex
             } else {
               moved = true
             }
             patch(
               prevChild,
               c2[newIndex] as VNode,
               container,
               null,
               parentComponent,
               parentSuspense,
               namespace,
               slotScopeIds,
               optimized,
             )
             patched++
           }
           }
           ```
           - 判断节点是否需要移动操作，如果需要移动则生成最长稳定子序列，从新节点未处理节点的尾部开始循环获取它在整个虚拟列表的位置索引，拿到虚拟节点，设置锚点，该虚拟节点的下一个节点在新列表里存在则使用这个节点的el做锚点否则用parentAnchor做锚点，判断当前节点在索引数组的值是否为0（有没有处理过），没处理过就将其挂载否则判断这个是否需要移动节点，当不存在稳定子序列或者当前节点不在稳定子序列列表中时候说明该节点需要移动调用move方法移动节点 （至此diff结束） 
