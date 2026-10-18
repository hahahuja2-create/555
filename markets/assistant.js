'use strict';
function assistantReply(message,lang,user,markets) {
  const ka=lang==='ka', text=String(message).toLocaleLowerCase();
  const answer=(topic,kaText,enText,links=[])=>({topic,text:ka?kaText:enText,links,automated:true});
  const coin=markets.find(item=>new RegExp('(^|[^a-z])'+item.base.toLowerCase()+'([^a-z]|$)').test(text)||text.includes(item.name.toLowerCase()));
  if (coin && /ფას|price|cost|რა ღირს|how much/.test(text)) return answer('markets',
    `${coin.name} (${coin.base}) — ${coin.price.toLocaleString('en-US',{maximumFractionDigits:8})} USDT. 24 საათის ცვლილება: ${coin.change.toFixed(2)}%. განახლდა ${new Date(coin.updatedAt).toLocaleTimeString('ka-GE',{timeZone:'UTC'})} UTC. ეს საბაზრო ინფორმაციაა, არა საინვესტიციო რჩევა.`,
    `${coin.name} (${coin.base}) is ${coin.price.toLocaleString('en-US',{maximumFractionDigits:8})} USDT. 24h change: ${coin.change.toFixed(2)}%. Quote time ${new Date(coin.updatedAt).toISOString()}. This is market information, not investment advice.`,[{view:'markets',label:ka?'ნახე ბაზარი':'View markets'}]);
  if (/დეპოზ|შევს|deposit|ჩარიცხ/.test(text)) return answer('deposits',
    'შევსება გახსენი „საფულე → დეპოზიტი“. მხარდაჭერილია USDT TRON (TRC20) ქსელში. დადასტურებული ჩარიცხვა Earning balance-ზე აისახება. მისამართი და ქსელი ყოველთვის უშუალოდ დეპოზიტის ფანჯარაში შეამოწმე.',
    'Open Wallet → Deposit. Supported deposits use USDT on TRON (TRC20). Confirmed deposits are credited to your Earning balance. Always check the address and network in the deposit dialog.',[{view:'wallet',label:ka?'საფულის გახსნა':'Open wallet'}]);
  if (/გატან|withdraw|fee|საკომის/.test(text)) return answer('withdrawals',
    'გატანის მოთხოვნა იგზავნება Spot ანგარიშიდან. მოქმედი მინიმუმია 10 USDT; საკომისიო — 10%. მოთხოვნა განიხილება ოპერატორის მიერ. სტატუსი და მისაღები თანხა საფულეში ჩანს. ბოტი გადარიცხვებს ვერ ასრულებს.',
    'Withdrawal requests use your Spot account. The current minimum is 10 USDT and the fee is 10%. An operator reviews each request. Your wallet shows the status and net amount. This assistant cannot transfer funds.',[{view:'wallet',label:ka?'გატანის სტატუსები':'Withdrawal status'}]);
  if (/vip|წევრო|პაკეტ|membership|plan|earn|claim|კლაიმ|დარიცხ|დღიური|task|დავალებ|reward|ჯილდო/.test(text)) return answer('earn',
    'TaskMall Earn-ზე ყველა მომხმარებელს ერთიანი 10%-იანი დღიური განაკვეთი აქვს. Claim კეთდება დღეში ერთხელ; ახალი დღე 00:00 UTC-ზე იწყება და თანხა Spot ბალანსზე ირიცხება. Earning balance არ მცირდება. Claim თანხას ანგარიშზე მაშინვე ასახავს. გატანის მოთხოვნის შემდეგ ოპერატორი რეალურ თანხას ხელით რიცხავს. VIP პაკეტის შეძენა აღარ არის საჭირო.',
    'TaskMall Earn uses a 10% daily platform reward rate for every account. Claim once per UTC day, resetting at 00:00 UTC; rewards credit Spot without reducing Earning balance. Claim credits the account immediately. An operator manually sends the actual payment after a withdrawal request. VIP purchases are no longer required.',[{view:'earn',label:ka?'გახსენი Earn':'Open Earn'}]);
  if (/რეფერ|referral|invite|დონე|level/.test(text)) return answer('referrals',
    'პირველი დონის რეფერალის მიღებული Earn ჯილდოდან გერიცხება 10%, მეორე დონისგან — 5%. თანხა შენს Spot ბალანსზე მაშინვე ჯდება; მოწვეულ მომხმარებელს ეს თანხა არ აკლდება.',
    'You receive 10% of a first-level referral’s claimed Earn reward and 5% of a second-level referral’s reward. Referral payments credit Spot immediately; they do not reduce the invited user’s reward.',[{view:'team',label:ka?'რეფერალები':'Referrals'}]);
  if (/ვაჭრ|შეძენ|ყიდვ|ბაზარ|spot|market|buy|sell|binance|ფას/.test(text)) return answer('trading',
    'ბაზრის ფასები რეალურ დროში ახლდება. ყიდვა/გაყიდვა TaskMall-ში სრულდება შენი Spot ბალანსით, ფასზე მიბმული შიდა პოზიციებით. პოზიციების რაოდენობა და ოპერაციები შენს ანგარიშში აღირიცხება; რეალურ ქოინს არ ფლობ და ბლოკჩეინზე ვერ გადარიცხავ. ფასები გარე ბაზრიდან მოდის; ბირჟაზე შეკვეთები არ იგზავნება. Earn და Spot ანგარიშები ცალკეა.',
    'Market prices update live. Buy and sell in TaskMall using your Spot balance with price-linked internal positions. Positions and trades are recorded in your account; they are not on-chain coins and cannot be withdrawn as crypto. External markets supply prices; no exchange orders are sent. Earn and Spot accounts are separate.',[{view:'markets',label:ka?'ცოცხალი ბაზარი':'Live markets'}]);
  if (/უსაფრთხ|პაროლ|security|password|seed|private|გასაღებ/.test(text)) return answer('security',
    'არასოდეს გააგზავნო პაროლი, seed ფრაზა ან API secret ჩატში. ანგარიშის მონაცემებს პროფილიდან მართავ. დახმარების ბოტი არასოდეს ითხოვს პირად გასაღებებს და ვერ ცვლის ანგარიშის თანხებს.',
    'Never send passwords, seed phrases or API secrets in chat. Manage account information from your profile. This assistant never requests private keys and cannot change your balances.',[{view:'me',label:ka?'ანგარიშის პარამეტრები':'Account settings'}]);
  if (/company|კომპანი|about|ვინ|taskmall/.test(text)) return answer('company',
    'TaskMall აერთიანებს Earn ჯილდოებს, რეფერალებს, USDT ანგარიშებსა და საბაზრო ინფორმაციას. პლატფორმის მუშაობის პრინციპები და ანგარიშების განმარტებები Company გვერდზეა. ეს ბოტი პლატფორმის ფუნქციებზე ავტომატურ ინფორმაციას გაწვდის.',
    'TaskMall combines Earn rewards, referrals, USDT accounts and market information. The Company page explains how the platform works and how accounts are separated. This assistant provides automated product guidance.',[{view:'company',label:ka?'TaskMall-ის შესახებ':'About TaskMall'}]);
  return answer('welcome',
    'გამარჯობა! TaskMall-ის ასისტენტი ვარ. დაგეხმარები დეპოზიტების, გატანის, Earn-ის, რეფერალებისა და კრიპტოფასების შესახებ. მაგალითად: „რა ღირს BTC?“, „როგორ გავიტანო?“ ან „როგორ მუშაობს Earn?“ ანგარიშის თანხებს ვერ ვცვლი და პერსონალურ საინვესტიციო რჩევას არ ვიძლევი.',
    'Hi! I’m the TaskMall assistant. Ask about deposits, withdrawals, Earn, referrals or crypto prices. Try “What is the BTC price?”, “How do I withdraw?” or “How does Earn work?” I cannot change balances or provide personal investment advice.',[{view:'support',label:ka?'დახმარების ცენტრი':'Support center'}]);
}
module.exports={assistantReply};
