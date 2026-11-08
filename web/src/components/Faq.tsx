import { ChevronDown } from "lucide-react";
import Link from "next/link";
import styles from "./home/home-discovery.module.css";

const faqs = [
  { question: "Do I need to sign in to explore CereBro?", answer: "No. Champion pages, crystal and relic catalogs, and champion acquisition sources are public. Sign in with Discord to manage your own roster and use your alliance's planning tools." },
  { question: "How do roster screenshots work?", answer: "Upload your in-game champion roster screenshots to CereBro in Discord. Image processing identifies your champions and updates the roster attached to your game profile." },
  { question: "Does everyone need to set up an alliance?", answer: "No. Officers configure the alliance, roles and channels. Members can join through Discord role sync or submit a website join request for an officer to approve." },
  { question: "Are the catalogs a live view of the game store?", answer: "No. They describe recorded definitions and reviewed sources, including historical ones. Category rates are shown where captured; a catalog listing does not establish current availability or an individual champion's drop chance." },
];

export function Faq() {
  return (
    <div className={styles.faqList}>
      {faqs.map(faq => <details key={faq.question} className={styles.faqItem}><summary>{faq.question}<ChevronDown aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}
      <details className={styles.faqItem}><summary>Is CereBro free to use?<ChevronDown aria-hidden="true" /></summary><p>Yes. CereBro is free to use. Contributions through the <Link href="/support">Support page</Link> help with development and hosting and are optional.</p></details>
    </div>
  );
}
