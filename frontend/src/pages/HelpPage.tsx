import {
  ArrowRightOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TableOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Card, Space, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';

const { Paragraph, Text, Title } = Typography;

interface QuickStartStep {
  title: string;
  description: string;
}

interface RuleCard {
  title: string;
  description: string;
  tag: string;
}

interface SectionLink {
  id: string;
  label: string;
}

function getRoleLabel(role: string | undefined, isZh: boolean): string {
  if (role === 'ADMIN') return isZh ? '管理员' : 'Admin';
  if (role === 'STORE_MANAGER') return isZh ? '店长' : 'Store Manager';
  return isZh ? '店员' : 'Staff';
}

function getScopeLabel(role: string | undefined, isZh: boolean): string {
  if (role === 'ADMIN') return isZh ? '可切换全部门店' : 'Can switch all stores';
  return isZh ? '自动锁定当前门店' : 'Locked to current store';
}

export function HelpPage(): JSX.Element {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const quickStartSteps = useMemo<QuickStartStep[]>(
    () =>
      isZh
        ? [
            { title: '先确认当前门店视图', description: '管理员可在支持门店切换的页面里查看全部门店或指定门店；店长和店员会自动锁定到自己的门店。' },
            { title: '先建客户，再做业务动作', description: '预约、维修、销售和验配都围绕客户档案展开。建议先建立完整客户档案，再继续后续流程。' },
            { title: '销售、库存、订单是一条链', description: '销售开单会同步生成订单并扣减库存；库存中心负责入库、调拨与库存核对；订单记录用于回看交易历史。' },
            { title: '售后服务从维修大盘开始', description: '维修大盘会按预计交付日自动排序，越早到期的记录越靠前，方便优先处理临近交付和已超期工单。' },
          ]
        : [
            { title: 'Confirm the current store scope first', description: 'Admins can inspect all stores or one store. Managers and staff stay locked to their assigned store.' },
            { title: 'Create the customer before acting', description: 'Appointments, repairs, sales, and fittings all begin from the customer record. Build the profile first.' },
            { title: 'Sales, inventory, and orders are linked', description: 'Sales POS creates orders and deducts inventory. Inventory Center handles inbound and transfers. Orders help you audit the history.' },
            { title: 'After-sales work starts from Repairs', description: 'The repair board sorts by due date so the earliest and most urgent work orders stay on top.' },
          ],
    [isZh],
  );

  const ruleCards = useMemo<RuleCard[]>(
    () =>
      isZh
        ? [
            { title: '客户防重录入', description: '当姓名、电话、性别、生日完全一致时，系统会阻止重复建档，避免历史档案被拆分。', tag: '防重' },
            { title: '门店视图联动', description: '客户管理、维修大盘、预约日历、订单记录、商品管理和库存中心都支持门店切换，先确认门店再看数据最稳妥。', tag: '门店' },
            { title: '维修优先级排序', description: '维修大盘默认按预计交付日升序展示，已交付记录不会干扰提醒，临近交付和已超期会高亮显示。', tag: '提醒' },
            { title: '权限与导入导出', description: '导入导出类操作默认仅管理员可见；店长和店员仍可完成客户、预约、维修、验配和销售等核心业务。', tag: '权限' },
          ]
        : [
            { title: 'Duplicate customer protection', description: 'The system blocks duplicate customer creation when name, phone, gender, and birth date are fully identical.', tag: 'Rules' },
            { title: 'Store-aware views', description: 'Customers, repairs, calendar, orders, products, and inventory all react to the selected store. Confirm the scope first.', tag: 'Stores' },
            { title: 'Repair priority order', description: 'Repairs are sorted by due date ascending. Delivered records stop triggering alerts while overdue and due-soon jobs remain highlighted.', tag: 'Alerts' },
            { title: 'Permissions and import/export', description: 'Import and export actions are reserved for admins, while managers and staff can still perform daily service and sales work.', tag: 'RBAC' },
          ],
    [isZh],
  );

  const moduleSections = useMemo(
    () => [
      {
        id: 'overview',
        title: isZh ? '工作台' : 'Dashboard',
        description: isZh ? '快速掌握今日重点、维修提醒和最近订单。' : 'Review today’s priorities, repair reminders, and recent orders.',
        modules: [
          {
            key: 'dashboard',
            title: isZh ? '工作台' : 'Dashboard',
            route: '/dashboard',
            audience: isZh ? '全员可用' : 'All roles',
            description: isZh ? '这是进入系统后的总览页面，用来查看今天最需要处理的事情。' : 'The landing page for the team’s most urgent daily tasks.',
            icon: <DashboardOutlined />,
            highlights: isZh ? ['查看近 7 日订单与营收概览', '查看今日预约与维修提醒', '直接跳转到高频业务模块'] : ['Review 7-day orders and revenue', 'Check today’s appointments and repairs', 'Jump directly into high-frequency modules'],
            tips: isZh ? ['每天上班先看一次工作台', '发现异常后再进入对应模块处理'] : ['Start each day here', 'Open the related module after spotting an exception'],
          },
        ],
      },
      {
        id: 'service',
        title: isZh ? '客户与服务' : 'Customers & Service',
        description: isZh ? '围绕客户档案展开预约、维修、验配与历史跟进。' : 'Customer records power appointments, repairs, fittings, and follow-up history.',
        modules: [
          {
            key: 'customers',
            title: isZh ? '客户管理' : 'Customers',
            route: '/customers',
            audience: isZh ? '全员可用' : 'All roles',
            description: isZh ? '建立客户档案并查看完整客户全景。' : 'Create customer records and inspect the full 360 customer view.',
            icon: <UserOutlined />,
            highlights: isZh ? ['按门店、姓名、电话快速筛选', '查看订单、维修、验配记录', '新建客户时自动校验重复录入'] : ['Filter by store, name, or phone', 'Inspect orders, repairs, and fittings', 'Duplicate customer creation is blocked automatically'],
            tips: isZh ? ['先建档再做预约、维修和销售', '发现重复客户时先搜历史档案'] : ['Create the customer before booking or selling', 'Search old records first when duplicates appear'],
          },
          {
            key: 'repairs',
            title: isZh ? '维修大盘' : 'Repairs',
            route: '/repairs',
            audience: isZh ? '全员可用' : 'All roles',
            description: isZh ? '集中处理售后维修，按交付时间排优先级。' : 'Manage after-sales repairs with due-date priority.',
            icon: <ToolOutlined />,
            highlights: isZh ? ['按客户、电话、机器型号模糊搜索', '支持新建、导入、导出', '临近交付和已超期会高亮提醒'] : ['Search by customer, phone, or machine model', 'Create, import, and export repair records', 'Due-soon and overdue repairs stay highlighted'],
            tips: isZh ? ['优先处理红色和橙色提醒', '录入时尽量补齐型号和交付日期'] : ['Handle red and orange alerts first', 'Fill the model and due date carefully'],
          },
          {
            key: 'calendar',
            title: isZh ? '预约日历' : 'Calendar',
            route: '/calendar',
            audience: isZh ? '全员可用' : 'All roles',
            description: isZh ? '按周查看预约安排，适合前台和验配服务排班。' : 'Plan appointments by week for front desk and service scheduling.',
            icon: <CalendarOutlined />,
            highlights: isZh ? ['按周查看七天安排', '支持按日期查看完整记录', '新增预约会同步到客户服务链路'] : ['Inspect seven days in one weekly strip', 'Filter the full record list by date', 'New appointments sync back into the customer workflow'],
            tips: isZh ? ['先切到正确门店再看安排', '新增预约前先确认客户已建档'] : ['Check the store scope before reviewing appointments', 'Make sure the customer already exists before booking'],
          },
        ],
      },
      {
        id: 'sales',
        title: isZh ? '销售与库存' : 'Sales & Inventory',
        description: isZh ? '从商品、库存到销售和订单形成完整经营闭环。' : 'Products, inventory, sales, and orders work as one business loop.',
        modules: [
          {
            key: 'sales',
            title: isZh ? '销售开单' : 'Sales POS',
            route: '/sales',
            audience: isZh ? '全员可用' : 'All roles',
            description: isZh ? '前台快速完成收银、客户绑定和库存扣减。' : 'Create sales, bind customers, and deduct stock in a single workspace.',
            icon: <ShoppingCartOutlined />,
            highlights: isZh ? ['支持拖拽或点击加入购物车', '自动校验库存数量', '提交后同步生成订单和销售流水'] : ['Add products by drag-and-drop or click', 'Inventory quantities are validated automatically', 'Orders and stock transactions are created together'],
            tips: isZh ? ['先选门店和客户再加商品', '购物车会始终悬浮在右侧'] : ['Choose the store and customer first', 'The cart stays visible on the right panel'],
          },
          {
            key: 'orders',
            title: isZh ? '订单记录' : 'Orders',
            route: '/orders',
            audience: isZh ? '全员可用' : 'All roles',
            description: isZh ? '回看历史销售、打印凭证和处理退货。' : 'Review historical sales, print receipts, and process returns.',
            icon: <TableOutlined />,
            highlights: isZh ? ['支持门店、客户、订单号搜索', '支持表格排序和悬浮预览', '支持打印凭证和退货'] : ['Search by store, customer, or order ID', 'Use table sorting and hover previews', 'Print receipts and process returns'],
            tips: isZh ? ['优先按时间倒序查看最新订单', '核对客户购买历史时可从客户档案进入'] : ['Sort by date descending for the newest orders', 'Open from customer profiles when auditing purchase history'],
          },
          {
            key: 'inventory',
            title: isZh ? '库存中心' : 'Inventory',
            route: '/inventory',
            audience: isZh ? '全员可用' : 'All roles',
            description: isZh ? '把库存查看、入库和调拨集中到一个页面。' : 'Review stock, inbound actions, and transfers in one unified page.',
            icon: <DatabaseOutlined />,
            highlights: isZh ? ['支持全部门店或单门店查看', '支持拖拽库存项到操作面板', '右侧操作面板始终可见'] : ['Inspect all stores or a single store', 'Drag stock cards into the action panel', 'The operation panel remains visible'],
            tips: isZh ? ['做入库或调拨前先确认当前门店视图', '悬浮预览可先看全参数再操作'] : ['Confirm the store scope before editing stock', 'Use hover previews to inspect full details first'],
          },
          {
            key: 'products',
            title: isZh ? '商品管理' : 'Products',
            route: '/products',
            audience: isZh ? '管理员' : 'Admins',
            description: isZh ? '维护产品资料库和 Excel 对齐字段。' : 'Maintain the product master catalog aligned with Excel fields.',
            icon: <TableOutlined />,
            highlights: isZh ? ['按门店和关键词模糊搜索', '支持导入导出', '悬浮即可查看完整商品参数'] : ['Filter by store and keyword', 'Supports import and export', 'Hover to inspect the full product profile'],
            tips: isZh ? ['先整理资料库，再导入库存或开单', '分类、品牌、规格越规范，后续检索越准确'] : ['Clean the master catalog before importing stock', 'Consistent categories and specs make search more reliable'],
          },
        ],
      },
      {
        id: 'system',
        title: isZh ? '系统管理' : 'System',
        description: isZh ? '管理员维护门店、员工与系统偏好。' : 'Admins maintain stores, employees, and system preferences.',
        modules: [
          {
            key: 'stores',
            title: isZh ? '门店管理' : 'Stores',
            route: '/stores',
            audience: isZh ? '管理员' : 'Admins',
            description: isZh ? '维护门店名称、地址、电话和门店类型。' : 'Manage store names, addresses, phone numbers, and store types.',
            icon: <ShopOutlined />,
            highlights: isZh ? ['按门店名称、地址、电话搜索', '支持新建门店', '门店会影响客户、预约、库存和销售归属'] : ['Search by name, address, or phone', 'Create new stores', 'Stores shape customers, appointments, inventory, and sales'],
            tips: isZh ? ['正式启用前先把门店资料建好', '保持门店名称稳定，减少历史数据混乱'] : ['Set up stores before daily operations', 'Keep store naming stable for cleaner history'],
          },
          {
            key: 'employees',
            title: isZh ? '员工管理' : 'Employees',
            route: '/employees',
            audience: isZh ? '管理员' : 'Admins',
            description: isZh ? '维护员工账号、角色和门店归属。' : 'Manage employee accounts, roles, and store assignments.',
            icon: <TeamOutlined />,
            highlights: isZh ? ['按用户名、角色、门店搜索', '支持新建员工和重置密码', '店长和店员会自动锁定门店视图'] : ['Search by username, role, and store', 'Create employees and reset passwords', 'Managers and staff stay locked to their store view'],
            tips: isZh ? ['启用前先确认角色和门店归属', '管理员账号保持精简更安全'] : ['Confirm role and store before enabling access', 'Keep admin accounts minimal and deliberate'],
          },
        ],
      },
    ],
    [isZh],
  );

  const faqs = useMemo<RuleCard[]>(
    () =>
      isZh
        ? [
            { title: '为什么看不到“全部门店”？', description: '只有管理员可切换到全部门店。店长和店员会自动锁定当前门店，这是正常的权限设计。', tag: 'FAQ' },
            { title: '为什么客户无法重复新建？', description: '系统会阻止姓名、电话、性别、生日完全一致的客户重复录入，避免同一客户被拆成多份档案。', tag: 'FAQ' },
            { title: '为什么维修单总是按时间排序？', description: '维修大盘默认把预计交付日最早的记录放在最前面，这样更符合门店处理待办的优先级。', tag: 'FAQ' },
            { title: '新手最推荐的起步顺序是什么？', description: '先确认门店，再建客户，然后根据业务进入预约、维修或销售，最后回到订单记录和客户档案核对结果。', tag: 'FAQ' },
          ]
        : [
            { title: 'Why can’t I see “All stores”?', description: 'Only admins can switch to an all-stores view. Managers and staff are intentionally locked to their own store.', tag: 'FAQ' },
            { title: 'Why can’t I create the same customer twice?', description: 'The system blocks duplicates when name, phone, gender, and birth date are fully identical.', tag: 'FAQ' },
            { title: 'Why are repairs always sorted by date?', description: 'Repairs are intentionally ordered by the earliest due date so the store can work from the most urgent job first.', tag: 'FAQ' },
            { title: 'What is the recommended beginner flow?', description: 'Confirm the store, create the customer, continue to appointment, repair, or sale, then review the result from Orders and the customer profile.', tag: 'FAQ' },
          ],
    [isZh],
  );

  const sectionLinks = useMemo<SectionLink[]>(
    () => [
      { id: 'start', label: isZh ? '快速开始' : 'Quick start' },
      { id: 'rules', label: isZh ? '核心规则' : 'Core rules' },
      { id: 'overview', label: isZh ? '工作台' : 'Dashboard' },
      { id: 'service', label: isZh ? '客户与服务' : 'Customers & Service' },
      { id: 'sales', label: isZh ? '销售与库存' : 'Sales & Inventory' },
      { id: 'system', label: isZh ? '系统管理' : 'System' },
      { id: 'faq', label: isZh ? '常见问题' : 'FAQ' },
    ],
    [isZh],
  );

  function scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="page-stack help-shell">
      <Card className="help-hero-card" bodyStyle={{ padding: 24 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Text className="help-kicker">{isZh ? '帮助中心' : 'Help Center'}</Text>
            <Title level={1} className="help-hero-title">
              {isZh ? '第一次使用 HearFlow，从这里开始' : 'Getting started with HearFlow'}
            </Title>
            <Paragraph className="help-hero-copy">
              {isZh
                ? '这份指南按真实门店工作流编排，适合前台、验配师、店长和管理员快速上手。你可以先按“快速开始”走一遍，再按模块逐个了解客户、预约、维修、销售、库存和系统设置。'
                : 'This guide follows a real store workflow so front desk staff, hearing specialists, store managers, and admins can get productive quickly. Start with Quick Start, then review each module in detail.'}
            </Paragraph>
          </div>

          <div className="surface-summary-strip">
            <div className="surface-summary-chip surface-summary-chip--accent">
              <Text type="secondary">{isZh ? '当前身份' : 'Current role'}</Text>
              <div className="surface-summary-value">{getRoleLabel(employee?.role, isZh)}</div>
            </div>
            <div className="surface-summary-chip">
              <Text type="secondary">{isZh ? '门店视图' : 'Store scope'}</Text>
              <div className="surface-summary-value">{getScopeLabel(employee?.role, isZh)}</div>
            </div>
            <div className="surface-summary-chip">
              <Text type="secondary">{isZh ? '推荐起步' : 'Suggested flow'}</Text>
              <div className="surface-summary-value">{isZh ? '客户 → 服务 → 销售 → 订单复查' : 'Customers → Service → Sales → Orders'}</div>
            </div>
          </div>
        </Space>
      </Card>

      <div className="help-layout">
        <div className="help-main">
          <section id="start" className="help-section">
            <div className="help-section-head">
              <div>
                <Text className="help-section-kicker">{isZh ? '快速开始' : 'Quick start'}</Text>
                <Title level={2} className="help-section-title">{isZh ? '先理解工作流，再开始操作' : 'Understand the workflow before you operate'}</Title>
              </div>
            </div>
            <div className="help-step-grid">
              {quickStartSteps.map((step, index) => (
                <Card key={step.title} className="help-step-card" bodyStyle={{ padding: 18 }}>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Tag color="blue">STEP {index + 1}</Tag>
                    <Text strong className="help-card-title">{step.title}</Text>
                    <Paragraph className="help-card-copy">{step.description}</Paragraph>
                  </Space>
                </Card>
              ))}
            </div>
          </section>

          <section id="rules" className="help-section">
            <div className="help-section-head">
              <div>
                <Text className="help-section-kicker">{isZh ? '核心规则' : 'Core rules'}</Text>
                <Title level={2} className="help-section-title">{isZh ? '这些规则会影响你在各模块里的操作结果' : 'These rules shape how the product behaves'}</Title>
              </div>
            </div>
            <div className="help-rule-grid">
              {ruleCards.map((rule) => (
                <Card key={rule.title} className="help-rule-card" bodyStyle={{ padding: 18 }}>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Tag>{rule.tag}</Tag>
                    <Text strong className="help-card-title">{rule.title}</Text>
                    <Paragraph className="help-card-copy">{rule.description}</Paragraph>
                  </Space>
                </Card>
              ))}
            </div>
          </section>

          {moduleSections.map((section) => (
            <section key={section.id} id={section.id} className="help-section">
              <div className="help-section-head">
                <div>
                  <Text className="help-section-kicker">{isZh ? '模块说明' : 'Module guide'}</Text>
                  <Title level={2} className="help-section-title">{section.title}</Title>
                  <Paragraph className="help-section-copy">{section.description}</Paragraph>
                </div>
              </div>
              <div className="help-module-grid">
                {section.modules.map((module) => (
                  <Card key={module.key} className="help-module-card" bodyStyle={{ padding: 18 }}>
                    <div className="help-module-head">
                      <div className="help-module-icon">{module.icon}</div>
                      <div className="help-module-meta">
                        <Space size={[8, 8]} wrap>
                          <Text strong className="help-card-title">{module.title}</Text>
                          <Tag>{module.audience}</Tag>
                        </Space>
                        <Paragraph className="help-card-copy">{module.description}</Paragraph>
                      </div>
                    </div>
                    <div className="help-module-block">
                      <Text className="help-list-title">{isZh ? '你可以在这里完成' : 'What you can do here'}</Text>
                      <div className="help-list">
                        {module.highlights.map((item) => (
                          <div key={item} className="help-list-item">
                            <span className="help-list-dot" />
                            <Text>{item}</Text>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-module-block">
                      <Text className="help-list-title">{isZh ? '新手建议' : 'Beginner tips'}</Text>
                      <div className="help-list">
                        {module.tips.map((item) => (
                          <div key={item} className="help-list-item">
                            <span className="help-list-dot help-list-dot--muted" />
                            <Text type="secondary">{item}</Text>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-module-footer">
                      <Button type="default" onClick={() => navigate(module.route)}>{isZh ? '打开模块' : 'Open module'}</Button>
                      <ArrowRightOutlined className="help-module-arrow" />
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}

          <section id="faq" className="help-section">
            <div className="help-section-head">
              <div>
                <Text className="help-section-kicker">{isZh ? '常见问题' : 'FAQ'}</Text>
                <Title level={2} className="help-section-title">{isZh ? '新手最常遇到的几个问题' : 'The most common questions from new users'}</Title>
              </div>
            </div>
            <div className="help-rule-grid">
              {faqs.map((item) => (
                <Card key={item.title} className="help-rule-card" bodyStyle={{ padding: 18 }}>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Tag>{item.tag}</Tag>
                    <Text strong className="help-card-title">{item.title}</Text>
                    <Paragraph className="help-card-copy">{item.description}</Paragraph>
                  </Space>
                </Card>
              ))}
            </div>
          </section>
        </div>

        <div className="floating-side-panel help-aside">
          <Card className="floating-side-panel-card" bodyStyle={{ padding: 18 }}>
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <div>
                <Text className="help-section-kicker">{isZh ? '页面导航' : 'Page navigation'}</Text>
                <Title level={4} style={{ marginTop: 6, marginBottom: 0 }}>{isZh ? '本页目录' : 'On this page'}</Title>
              </div>
              <div className="help-anchor-list">
                {sectionLinks.map((item) => (
                  <Button key={item.id} className="help-anchor-btn" onClick={() => scrollToSection(item.id)}>
                    {item.label}
                  </Button>
                ))}
              </div>
              <Card className="help-tip-card" bodyStyle={{ padding: 16 }}>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Tag color="blue">{isZh ? '推荐路径' : 'Recommended path'}</Tag>
                  <Text strong>{isZh ? '一天之内完成第一次完整演练' : 'Complete a full first-run workflow in one day'}</Text>
                  <Paragraph className="help-card-copy" style={{ marginBottom: 0 }}>
                    {isZh
                      ? '最推荐的新手练习顺序是：先建客户，再新增预约，接着录入维修或直接完成一次销售，最后回到订单记录与客户档案核对结果。'
                      : 'A strong first-run practice flow is: create a customer, add an appointment, record a repair or sale, then review the result from Orders and the customer profile.'}
                  </Paragraph>
                </Space>
              </Card>
            </Space>
          </Card>
        </div>
      </div>
    </div>
  );
}
