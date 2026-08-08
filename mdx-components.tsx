import type { MDXComponents } from "mdx/types";

// Typography for the /why essay. Body in Supreme, headings in Clash Display,
// on the shared dark ground — a reading page, not a deck.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: ({ children, ...props }) => (
      <h2
        className="mt-20 scroll-mt-24 font-display text-2xl font-semibold leading-[1.12] text-cream sm:text-[2rem]"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="mt-12 font-display text-xl font-semibold text-cream" {...props}>
        {children}
      </h3>
    ),
    p: ({ children, ...props }) => (
      <p className="mt-6 text-[1.075rem] leading-[1.75] text-mauve-dim [&>strong]:text-cream" {...props}>
        {children}
      </p>
    ),
    a: ({ children, ...props }) => (
      <a
        className="text-cream underline decoration-gold/50 underline-offset-4 transition-colors hover:decoration-gold"
        {...props}
      >
        {children}
      </a>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-medium text-cream" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }) => (
      <em className="text-cream/90" {...props}>
        {children}
      </em>
    ),
    ul: ({ children, ...props }) => (
      <ul className="mt-6 space-y-2.5 text-[1.075rem] leading-[1.7] text-mauve-dim" {...props}>
        {children}
      </ul>
    ),
    li: ({ children, ...props }) => (
      <li className="flex gap-3" {...props}>
        <span className="mt-3 inline-block h-1 w-1 flex-none rounded-full bg-gold/70" aria-hidden="true" />
        <span>{children}</span>
      </li>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="mt-8 border-l-2 border-gold/60 pl-5 text-[1.075rem] italic leading-[1.7] text-cream/90"
        {...props}
      >
        {children}
      </blockquote>
    ),
    hr: (props) => <hr className="my-16 border-plum-hi" {...props} />,
    ...components,
  };
}
