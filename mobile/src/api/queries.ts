/** Raw GraphQL documents. Kept as plain strings (no codegen) to match what
 * was actually verified against the live stores -- see mobile/README.md. */

export const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      nodes {
        id
        title
        handle
        featuredImage {
          url
          altText
          width
          height
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const PRODUCT_QUERY = /* GraphQL */ `
  query Product($handle: String!) {
    product(handle: $handle) {
      id
      title
      descriptionHtml
      images(first: 10) {
        nodes {
          url
          altText
          width
          height
        }
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      variants(first: 20) {
        nodes {
          id
          title
          availableForSale
          price {
            amount
            currencyCode
          }
        }
      }
      pdpModules: metafield(namespace: "custom", key: "pdp_modules") {
        references(first: 10) {
          nodes {
            ... on Metaobject {
              id
              type
              fields {
                key
                value
              }
            }
          }
        }
      }
    }
  }
`;

export const THEME_QUERY = /* GraphQL */ `
  query Theme {
    metaobjects(type: "demo_brand_theme", first: 1) {
      nodes {
        id
        fields {
          key
          value
        }
      }
    }
  }
`;
