import { PrismaClient, Difficulty } from '@prisma/client';

const prisma = new PrismaClient();

// Template questions for empty categories
const categoryTemplates: Record<string, {
  easy: string[];
  medium: string[];
  hard: string[];
}> = {
  'React': {
    easy: [
      'React nima?|JavaScript kutubxonasi|Framework|Backend texnologiya|Database',
      'JSX nima?|JavaScript XML sintaksisi|CSS framework|HTML template|Java extension',
      'Component nima?|UI qismi|Database|API|Server',
      'Props nima?|Component parametrlari|State|Function|Class',
      'State nima?|Component ma\'lumoti|Props|Event|Hook',
      'useState nima?|Hook state uchun|Component|Props|Event',
      'useEffect nima?|Side effect hook|State hook|Props hook|Event hook',
      'Key prop nima uchun?|List elementlarini identifikatsiya|Styling|Event|State',
      'Virtual DOM nima?|DOM representatsiyasi|Real DOM|Database|API',
      'React.Fragment nima?|Wrapper element|Component|Hook|State'
    ],
    medium: [
      'React Router nima uchun?|Routing uchun|Styling uchun|State management|API calls',
      'Context API nima?|Global state|Local state|Props|Event',
      'useContext nima?|Context hook|State hook|Effect hook|Ref hook',
      'useRef nima?|DOM reference|State|Props|Event',
      'useMemo nima uchun?|Memoization|State|Effect|Ref',
      'useCallback nima uchun?|Function memoization|State management|DOM manipulation|API calls',
      'React.memo nima?|Component memoization|State|Props|Hook',
      'Controlled component nima?|React tomonidan boshqariladigan|Uncontrolled|Props|State',
      'Uncontrolled component nima?|DOM tomonidan boshqariladigan|Controlled|Props|State',
      'Higher-Order Component (HOC) nima?|Component qaytaruvchi function|Hook|State|Props'
    ],
    hard: [
      'React Fiber nima?|Yangi reconciliation algoritmi|Old algoritm|Hook|State',
      'Reconciliation nima?|Virtual DOM taqqoslash jarayoni|Rendering|State update|Props update',
      'Code splitting nima uchun?|Bundle hajmini kamaytirish|Styling|State management|Routing',
      'Lazy loading nima?|Component lazy import|Eager loading|State|Props',
      'Suspense nima uchun?|Lazy component uchun fallback|Error handling|State|Props',
      'Error boundaries nima?|Error handling component|State|Props|Hook',
      'Portal nima?|DOM tree tashqarisida render|Component|State|Props',
      'Render props pattern nima?|Function as prop pattern|State pattern|Props pattern|Hook pattern',
      'Custom hooks qanday yasaladi?|use bilan boshlanadigan function|Component|Class|Function',
      'useReducer nima uchun?|Complex state logic|Simple state|Props|Event'
    ]
  },
  'Vue.js': {
    easy: [
      'Vue.js nima?|JavaScript framework|Backend framework|Database|Library',
      'v-model nima?|Two-way binding|One-way binding|Event|Method',
      'v-if nima uchun?|Conditional rendering|Loop|Event|Method',
      'v-for nima uchun?|List rendering|Conditional|Event|Method',
      'v-on nima uchun?|Event handling|Data binding|Loop|Conditional',
      'v-bind nima uchun?|Attribute binding|Event|Method|Loop',
      'Computed properties nima?|Hisoblangan properties|Methods|Data|Props',
      'Methods nima?|Component funksiyalari|Data|Computed|Props',
      'Data nima?|Component state|Methods|Computed|Props',
      'Props nima?|Parent dan child ga data|Methods|Computed|Data'
    ],
    medium: [
      'Vuex nima?|State management library|Router|Component|Plugin',
      'Vue Router nima?|Routing library|State management|Component|Plugin',
      'Lifecycle hooks nima?|Component lifecycle funksiyalari|Methods|Computed|Data',
      'Mixins nima?|Reusable logic|Component|Plugin|Directive',
      'Directives nima?|DOM manipulation|Component|Method|Data',
      'Custom directives qanday yasaladi?|Vue.directive()|Component|Method|Data',
      'Filters nima uchun?|Data formatting|Component|Method|Directive',
      'Slots nima?|Content distribution|Component|Method|Data',
      'Scoped slots nima?|Data bilan slot|Simple slot|Component|Method',
      'Watchers nima?|Data o\'zgarishlarni kuzatish|Methods|Computed|Data'
    ],
    hard: [
      'Composition API nima?|Vue 3 yangi API|Options API|Component|Plugin',
      'setup() function nima?|Composition API entry point|Lifecycle hook|Method|Data',
      'ref() va reactive() farqi?|ref primitive, reactive object|No difference|Both for primitive|Both for object',
      'provide/inject nima uchun?|Dependency injection|State management|Props|Event',
      'Teleport nima?|DOM element ko\'chirish|Component|Directive|Plugin',
      'Suspense nima uchun?|Async component handling|Error handling|State|Props',
      'Custom renderer nima?|Platform-agnostic rendering|Component|Plugin|Directive',
      'Compile-time optimization nima?|Vue 3 optimization|Runtime optimization|No optimization|Manual optimization',
      'Tree-shaking qanday ishlaydi?|Unused code removal|All code included|Manual removal|No removal',
      'Virtual DOM diff algoritmi qanday?|Patch-based diffing|Full re-render|No diffing|Manual diffing'
    ]
  },
  'Rust': {
    easy: [
      'Rust nima?|Systems programming language|JavaScript|Python|Java',
      'Cargo nima?|Package manager|Compiler|Runtime|Database',
      'fn keyword nima uchun?|Function declaration|Variable|Constant|Type',
      'let keyword nima?|Variable declaration|Function|Constant|Type',
      'mut keyword nima?|Mutable variable|Immutable|Function|Type',
      'println! nima?|Print macro|Function|Variable|Type',
      'String va &str farqi?|Owned vs borrowed|No difference|Both owned|Both borrowed',
      'Ownership nima?|Memory management concept|Type system|Function|Variable',
      'Borrowing nima?|Temporary ownership|Permanent ownership|No ownership|Full ownership',
      'Lifetime nima?|Reference validity scope|Variable scope|Function scope|Type scope'
    ],
    medium: [
      'Match expression nima?|Pattern matching|If statement|Loop|Function',
      'Option<T> nima uchun?|Null safety|Error handling|Type safety|Memory safety',
      'Result<T,E> nima uchun?|Error handling|Null safety|Type safety|Memory safety',
      'Trait nima?|Shared behavior|Class|Interface|Type',
      'impl keyword nima?|Implementation|Import|Interface|Inherit',
      'Generic types nima?|Type parameters|Concrete types|No types|Fixed types',
      'Enum nima?|Variant types|Class|Struct|Trait',
      'Struct nima?|Custom data type|Class|Enum|Trait',
      'Module system qanday?|mod keyword|import|package|namespace',
      'Cargo.toml nima?|Project manifest|Source code|Binary|Library'
    ],
    hard: [
      'Zero-cost abstractions nima?|Runtime overhead yo\'q|High overhead|Medium overhead|Low overhead',
      'Borrow checker qanday ishlaydi?|Compile-time checking|Runtime checking|No checking|Manual checking',
      'Interior mutability nima?|Mutable borrow immutable reference|Normal mutability|No mutability|Full mutability',
      'Rc<T> va Arc<T> farqi?|Single vs multi-thread|No difference|Both single|Both multi',
      'RefCell<T> nima uchun?|Runtime borrow checking|Compile-time|No checking|Manual',
      'Macro system qanday?|Metaprogramming|Functions|Types|Variables',
      'async/await qanday ishlaydi?|Cooperative concurrency|Preemptive|Threading|Blocking',
      'Unsafe Rust nima?|Memory safety bypass|Type safety|Function safety|Variable safety',
      'PhantomData<T> nima uchun?|Unused type parameter|Used parameter|No parameter|All parameters',
      'Drop trait nima?|Destructor|Constructor|Function|Method'
    ]
  },
  'Redis': {
    easy: [
      'Redis nima?|In-memory database|Relational DB|File system|Web server',
      'Redis qaysi tilga o\'xshaydi?|Key-value store|SQL|NoSQL document|Graph DB',
      'SET command nima qiladi?|Key-value set|Delete|Get|Update',
      'GET command nima qiladi?|Value get|Set|Delete|Update',
      'DEL command nima qiladi?|Key delete|Set|Get|Update',
      'EXISTS command nima?|Key mavjudligini tekshirish|Create|Delete|Update',
      'KEYS pattern nima?|Key qidirish|Value search|Delete|Create',
      'EXPIRE nima uchun?|TTL set|Delete|Get|Update',
      'TTL nima?|Time to live|Total time|Transaction time|Transfer time',
      'PERSIST nima?|TTL olib tashlash|Set TTL|Get TTL|Delete key'
    ],
    medium: [
      'Redis data types qaysilar?|String, List, Set, Hash, Sorted Set|Faqat String|Faqat Number|Faqat JSON',
      'LPUSH va RPUSH farqi?|Left vs right push|No difference|Both left|Both right',
      'SADD nima uchun?|Set add|List add|Hash add|String add',
      'HSET nima?|Hash field set|String set|List set|Set add',
      'ZADD nima?|Sorted set add|Set add|List add|Hash add',
      'Pub/Sub nima?|Message pattern|Database|Cache|Queue',
      'PUBLISH command nima?|Message yuborish|Subscribe|Unsubscribe|Receive',
      'SUBSCRIBE nima?|Channel subscribe|Publish|Unsubscribe|Message',
      'Transaction qanday?|MULTI/EXEC|BEGIN/COMMIT|START/END|TRANSACTION/END',
      'WATCH nima uchun?|Optimistic locking|Pessimistic lock|No lock|Full lock'
    ],
    hard: [
      'Redis Cluster nima?|Distributed Redis|Single Redis|Replication|Backup',
      'Redis Sentinel nima?|High availability|Clustering|Backup|Cache',
      'Replication qanday ishlaydi?|Master-slave|Peer-to-peer|No replication|Full sync',
      'AOF nima?|Append-only file|Snapshot|Memory|Cache',
      'RDB nima?|Redis database snapshot|Append file|Memory|Cache',
      'Persistence options qaysilar?|RDB, AOF, both, none|Faqat RDB|Faqat AOF|No persistence',
      'Eviction policies qaysilar?|LRU, LFU, Random, TTL|Faqat LRU|Faqat LFU|No eviction',
      'Lua scripting nima uchun?|Atomic operations|Normal commands|No scripting|Client-side',
      'Redis Modules nima?|Extension system|Core feature|No modules|Built-in only',
      'Redis Streams nima?|Log data structure|List|Set|Hash'
    ]
  },
  'SQL': {
    easy: [
      'SQL nima?|Structured Query Language|Scripting language|Programming language|Markup language',
      'SELECT nima?|Data select|Insert|Update|Delete',
      'FROM qayerda ishlatiladi?|Table specify|Column|Where|Join',
      'WHERE nima uchun?|Filter rows|Select all|Insert|Update',
      'INSERT nima?|Add new row|Update row|Delete row|Select row',
      'UPDATE nima?|Modify data|Insert|Delete|Select',
      'DELETE nima?|Remove rows|Insert|Update|Select',
      'CREATE TABLE nima?|Table yaratish|Delete table|Update table|Select table',
      'DROP TABLE nima?|Table o\'chirish|Create table|Update table|Select table',
      'Primary key nima?|Unique identifier|Foreign key|Index|Column'
    ],
    medium: [
      'JOIN qanday ishlaydi?|Table birlashtirish|Filter|Group|Sort',
      'INNER JOIN nima?|Matching rows|All left|All right|All rows',
      'LEFT JOIN nima?|All left + matching|All right|Inner|Cross',
      'GROUP BY nima uchun?|Aggregate grouping|Filter|Join|Sort',
      'HAVING nima?|Group filter|Row filter|Join condition|Sort order',
      'ORDER BY nima?|Sort results|Filter|Group|Join',
      'DISTINCT nima?|Unique values|All values|Null values|Duplicate values',
      'COUNT() nima?|Row count|Sum|Average|Max',
      'SUM() nima?|Total sum|Count|Average|Max',
      'AVG() nima?|Average|Sum|Count|Max'
    ],
    hard: [
      'Subquery nima?|Nested query|Join|Union|Group',
      'UNION va UNION ALL farqi?|Distinct vs All|No difference|Both distinct|Both all',
      'INDEX nima uchun?|Query optimization|Data integrity|Data type|Constraint',
      'FOREIGN KEY nima?|Reference constraint|Primary key|Unique|Index',
      'TRANSACTION nima?|Atomic operation group|Single query|Database|Table',
      'ACID nima?|Atomicity, Consistency, Isolation, Durability|Transaction type|Database type|Query type',
      'Normalization nima?|Database design|Query|Index|Join',
      'Denormalization nima uchun?|Performance optimization|Data integrity|Storage|Security',
      'View nima?|Virtual table|Real table|Index|Constraint',
      'Stored Procedure nima?|Reusable SQL code|Query|Function|Table'
    ]
  },
  'Tailwind CSS': {
    easy: [
      'Tailwind CSS nima?|Utility-first CSS framework|Component library|JavaScript framework|Backend framework',
      'Utility class nima?|Single purpose class|Multiple purpose|Component|Element',
      'text-center nima?|Text center align|Text left|Text right|Text justify',
      'bg-blue-500 nima?|Background blue|Text blue|Border blue|Color blue',
      'p-4 nima?|Padding 1rem|Margin|Border|Width',
      'm-4 nima?|Margin 1rem|Padding|Border|Height',
      'w-full nima?|Width 100%|Height 100%|Width 50%|Height 50%',
      'h-screen nima?|Height 100vh|Width 100vw|Height 50vh|Width 50vw',
      'flex nima?|Flexbox|Grid|Block|Inline',
      'grid nima?|Grid layout|Flexbox|Block|Inline'
    ],
    medium: [
      'hover: prefix nima?|Hover state|Focus|Active|Visited',
      'responsive design qanday?|sm:, md:, lg:, xl:|Faqat sm:|Faqat md:|No responsive',
      'dark: prefix nima?|Dark mode|Light mode|Hover|Focus',
      'group hover nima?|Parent hover|Self hover|Child hover|No hover',
      '@apply directive nima?|Custom CSS|Utility|Component|Theme',
      'JIT mode nima?|Just-in-Time compilation|Ahead-of-Time|Runtime|No compilation',
      'purge nima uchun?|Unused CSS removal|CSS generation|CSS minification|CSS validation',
      'tailwind.config.js nima?|Configuration file|CSS file|JavaScript file|HTML file',
      'theme.extend nima?|Custom theme|Default theme|No theme|Override theme',
      'plugins nima uchun?|Functionality extension|Theme|Config|Purge'
    ],
    hard: [
      'Custom utility qanday yasaladi?|addUtilities plugin|CSS file|JavaScript|HTML',
      'Custom variant qanday?|addVariant plugin|CSS|JavaScript|HTML',
      'CSS-in-JS bilan integratsiya?|Twin.macro, styled-components|No integration|Only CSS|Only JS',
      'Component extraction qachon?|Repetitive utilities|Single use|Never|Always',
      'Performance optimization?|PurgeCSS, minification|No optimization|Only minification|Only compression',
      '@layer directive nima?|Layer organization|Utility|Component|Theme',
      'Important strategy qaysilar?|Selector, !important|Faqat selector|Faqat !important|No strategy',
      'Arbitrary values qanday?|[value] syntax|No arbitrary|Fixed values|Only theme',
      'Prefix option nima uchun?|Class name collision|Theme|Purge|Plugin',
      'Content configuration nima?|File paths for purge|Theme|Plugin|Variant'
    ]
  }
};

async function generateQuestions() {
  console.log('🎯 Generating questions for empty categories...\n');
  
  const emptyCategories = ['React', 'Vue.js', 'Rust', 'Redis', 'SQL', 'Tailwind CSS'];
  
  for (const categoryName of emptyCategories) {
    const category = await prisma.category.findFirst({
      where: { name: categoryName }
    });
    
    if (!category) {
      console.log(`⚠️  Category ${categoryName} not found`);
      continue;
    }
    
    const template = categoryTemplates[categoryName];
    if (!template) {
      console.log(`⚠️  No template for ${categoryName}`);
      continue;
    }
    
    console.log(`📝 Generating questions for ${categoryName}...`);
    
    const difficulties: Array<{ level: Difficulty; questions: string[] }> = [
      { level: 'EASY', questions: template.easy },
      { level: 'MEDIUM', questions: template.medium },
      { level: 'HARD', questions: template.hard }
    ];
    
    let totalGenerated = 0;
    
    for (const { level, questions } of difficulties) {
      for (const questionData of questions) {
        const [question, ...options] = questionData.split('|');
        
        if (options.length !== 4) {
          console.log(`  ⚠️  Invalid question format: ${questionData.substring(0, 50)}`);
          continue;
        }
        
        // First option is always correct, then we shuffle
        const correctAnswer = 0;
        
        await prisma.question.create({
          data: {
            categoryId: category.id,
            question: question.trim(),
            options: options.map(opt => opt.trim()),
            correctAnswer,
            difficulty: level
          }
        });
        
        totalGenerated++;
      }
      
      console.log(`  ✓ ${level}: ${questions.length} questions`);
    }
    
    console.log(`  ✅ Total generated for ${categoryName}: ${totalGenerated}\n`);
  }
  
  const total = await prisma.question.count();
  console.log(`\n✅ Generation complete! Total questions in DB: ${total}\n`);
}

generateQuestions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
